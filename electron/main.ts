import path from 'path';
import { config as loadEnv } from 'dotenv';

// Electron 메인 프로세스에서 .env 로드 (npm run electron:dev 시 프로젝트 루트 기준)
loadEnv({ path: path.join(process.cwd(), '.env') });

import { app, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import { buildGeminiReadabilityRequest } from './readabilityPrompt';
import { buildGeminiDocPolishRequest } from './docPolishPrompt';

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
  ipcMain.handle('ai:improveReadability', async (_e: IpcMainInvokeEvent, text: string): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY || readSettings().geminiApiKey;
    if (!apiKey?.trim()) {
      throw new Error('설정에서 Gemini API 키를 입력해 주세요.');
    }
    const { systemInstruction, contents } = buildGeminiReadabilityRequest(text);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemInstruction,
        contents,
        generationConfig: { temperature: 0.3 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts;
    const content = parts?.[0]?.text?.trim();
    if (content == null) throw new Error('API 응답에 내용이 없습니다.');
    return content;
  });

  ipcMain.handle('ai:polishDeveloperDoc', async (_e: IpcMainInvokeEvent, text: string): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY || readSettings().geminiApiKey;
    if (!apiKey?.trim()) {
      throw new Error('설정에서 Gemini API 키를 입력해 주세요.');
    }
    const { systemInstruction, contents } = buildGeminiDocPolishRequest(text);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemInstruction,
        contents,
        generationConfig: { temperature: 0.25 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts;
    const out = parts?.[0]?.text?.trim();
    if (out == null) throw new Error('API 응답에 내용이 없습니다.');
    return out;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
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
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
