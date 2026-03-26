import path from 'path';
import { config as loadEnv } from 'dotenv';

// Electron 메인 프로세스에서 .env 로드 (npm run electron:dev 시 프로젝트 루트 기준)
loadEnv({ path: path.join(process.cwd(), '.env') });

import { app, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import { buildGeminiReadabilityRequest } from './readabilityPrompt';
import { buildGeminiDocPolishRequest } from './docPolishPrompt';

type TransformOption = 'balanced' | 'strong' | 'concise';

function normalizeTransformOption(option?: string): TransformOption {
  if (option === 'strong' || option === 'concise' || option === 'balanced') return option;
  return 'balanced';
}

function temperatureByOption(option: TransformOption, base: number): number {
  if (option === 'strong') return Math.min(0.6, base + 0.15);
  if (option === 'concise') return Math.max(0.1, base - 0.1);
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

async function callGeminiWithRetry(url: string, body: unknown): Promise<unknown> {
  const maxAttempts = 4;
  let lastStatus = 0;
  let lastErrorBody = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) return (await res.json()) as unknown;

    lastStatus = res.status;
    lastErrorBody = await res.text();

    if (!isRetryableStatus(res.status) || attempt === maxAttempts) {
      break;
    }

    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 0;
    const baseDelayMs = 600 * 2 ** (attempt - 1);
    const jitterMs = Math.floor(Math.random() * 350);
    const delayMs = Math.max(retryAfterMs, baseDelayMs + jitterMs);
    await sleep(delayMs);
  }

  if (lastStatus === 503) {
    throw new Error('Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요. (503)');
  }
  if (lastStatus === 429) {
    throw new Error('요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. (429)');
  }
  throw new Error(`Gemini API 오류 (${lastStatus}): ${lastErrorBody}`);
}

function extractGeminiText(data: unknown): string {
  const content = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates?.[0]?.content?.parts?.[0]?.text
    ?.trim();
  if (content == null) throw new Error('API 응답에 내용이 없습니다.');
  return content;
}

function getNotesDir(): string {
  return path.join(app.getPath('userData'), 'notes');
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

type Settings = { geminiApiKey?: string };

function readSettings(): Settings {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw) as Settings;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeSettings(settings: Settings): void {
  const p = getSettingsPath();
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
}

function ensureNotesDir(): string {
  const dir = getNotesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣_\-\s.]/g, '_').trim() || 'note';
}

function registerIpcHandlers() {
  const { ipcMain } = require('electron');
  ipcMain.handle('notes:list', () => {
    const dir = ensureNotesDir();
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        id: f,
        title: path.basename(f, '.md'),
      }))
      .sort((a, b) => (b.id > a.id ? 1 : -1));
  });
  ipcMain.handle('notes:read', (_e: IpcMainInvokeEvent, filename: string) => {
    const dir = ensureNotesDir();
    const filePath = path.join(dir, filename.endsWith('.md') ? filename : `${filename}.md`);
    if (!path.resolve(filePath).startsWith(path.resolve(dir)) || !fs.existsSync(filePath)) {
      throw new Error('Not found');
    }
    return fs.readFileSync(filePath, 'utf-8');
  });
  ipcMain.handle('notes:save', (_e: IpcMainInvokeEvent, filename: string, content: string) => {
    const dir = ensureNotesDir();
    const base = filename.endsWith('.md') ? filename : `${filename}.md`;
    const filePath = path.join(dir, base);
    if (!path.resolve(filePath).startsWith(path.resolve(dir))) {
      throw new Error('Invalid path');
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { id: base, title: path.basename(base, '.md') };
  });
  ipcMain.handle('notes:create', (_e: IpcMainInvokeEvent, title: string) => {
    const dir = ensureNotesDir();
    const base = `${safeFilename(title || '새 노트')}.md`;
    let filePath = path.join(dir, base);
    let name = base;
    let i = 1;
    while (fs.existsSync(filePath)) {
      name = `${safeFilename(title || '새 노트')}_${i}.md`;
      filePath = path.join(dir, name);
      i += 1;
    }
    fs.writeFileSync(filePath, `# ${path.basename(name, '.md')}\n\n`, 'utf-8');
    return { id: name, title: path.basename(name, '.md') };
  });
  ipcMain.handle('notes:delete', (_e: IpcMainInvokeEvent, filename: string) => {
    const dir = ensureNotesDir();
    const base = filename.endsWith('.md') ? filename : `${filename}.md`;
    const filePath = path.join(dir, base);
    if (!path.resolve(filePath).startsWith(path.resolve(dir))) {
      throw new Error('Invalid path');
    }
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  // 설정: Gemini API 키 저장/조회
  ipcMain.handle('app:getSettings', (): Settings => readSettings());
  ipcMain.handle('app:setGeminiKey', (_e: IpcMainInvokeEvent, key: string): void => {
    writeSettings({ ...readSettings(), geminiApiKey: key.trim() || undefined });
  });

  // AI 가독성 변환 (Few-shot 프롬프트 사용, Gemini API 무료 티어)
  ipcMain.handle(
    'ai:improveReadability',
    async (_e: IpcMainInvokeEvent, text: string, optionRaw?: string): Promise<string> => {
      const option = normalizeTransformOption(optionRaw);
      const apiKey = process.env.GEMINI_API_KEY || readSettings().geminiApiKey;
      if (!apiKey?.trim()) {
        throw new Error('설정에서 Gemini API 키를 입력해 주세요.');
      }
      const { systemInstruction, contents } = buildGeminiReadabilityRequest(text, option);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const data = await callGeminiWithRetry(url, {
        system_instruction: systemInstruction,
        contents,
        generationConfig: { temperature: temperatureByOption(option, 0.3) },
      });
      return extractGeminiText(data);
    }
  );

  ipcMain.handle(
    'ai:polishDeveloperDoc',
    async (_e: IpcMainInvokeEvent, text: string, optionRaw?: string): Promise<string> => {
      const option = normalizeTransformOption(optionRaw);
      const apiKey = process.env.GEMINI_API_KEY || readSettings().geminiApiKey;
      if (!apiKey?.trim()) {
        throw new Error('설정에서 Gemini API 키를 입력해 주세요.');
      }
      const { systemInstruction, contents } = buildGeminiDocPolishRequest(text, option);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const data = await callGeminiWithRetry(url, {
        system_instruction: systemInstruction,
        contents,
        generationConfig: { temperature: temperatureByOption(option, 0.25) },
      });
      return extractGeminiText(data);
    }
  );
}

function resolveWindowIcon(): string | undefined {
  const candidate = path.join(__dirname, '../build/icon.png');
  return fs.existsSync(candidate) ? candidate : undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    win.loadURL('http://localhost:5178');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  if (!app.isPackaged) win.webContents.openDevTools();
}

app.whenReady().then(() => {
  registerIpcHandlers();
  /** macOS 개발 모드: 실행 바이너리는 Electron이라 Dock 기본 아이콘 → 커스텀으로 맞춤 */
  if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
    const icon = resolveWindowIcon();
    if (icon) {
      try {
        app.dock.setIcon(icon);
      } catch {
        /* ignore */
      }
    }
  }
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
