# Note App

Electron + React + TypeScript 기반 로컬 마크다운(.md) 노트 앱입니다.

## 실행 방법

```bash
cd note-app
npm install
npm run build:electron   # 메인/프리로드 컴파일
npm run electron:dev    # Vite + Electron 동시 실행
```

**중요:** `electron:dev`는 **시스템 터미널**(Cursor/IDE 내장 터미널이 아닌, macOS Terminal 또는 iTerm 등)에서 실행하는 것을 권장합니다. 일부 환경에서는 `require('electron')`이 경로 문자열을 반환해 `app`/`BrowserWindow`가 undefined가 될 수 있습니다. 그 경우 터미널에서 직접 실행해 보세요.

- **개발**: `npm run electron:dev` — Vite 개발 서버 + Electron 창 (HMR)
- **빌드**: `npm run build` — React 빌드 + Electron 메인/프리로드 컴파일
- **패키징**: `npm run electron:build` — 실행 파일 생성

## 저장 위치

노트는 **로컬 .md 파일**로 저장됩니다.

- 경로: `app.getPath('userData')/notes`
  - macOS: `~/Library/Application Support/note-app/notes`
  - Windows: `%APPDATA%/note-app/notes`
  - Linux: `~/.config/note-app/notes`

## 구조

- `electron/main.ts` — 메인 프로세스, 창 생성 및 노트 파일 읽기/쓰기 IPC
- `electron/preload.ts` — `window.electronAPI.notes` 브릿지
- `src/` — React UI (노트 목록 + 마크다운 텍스트 에디터)
