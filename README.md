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

## GitHub Actions로 Windows .exe 빌드

맥에서 Wine 없이, GitHub의 Windows 러너로 NSIS 설치 파일을 만들 수 있습니다.

1. 저장소를 GitHub에 푸시합니다.
2. **Actions** → **Build Electron (Windows)** 워크플로를 연 뒤 **Run workflow**로 수동 실행하거나, `main` / `master`에 푸시하면 자동 실행됩니다.
3. 실행이 끝나면 해당 실행 페이지 하단 **Artifacts**에서 `note-app-windows-…` zip을 받습니다. 압축을 풀면 `.exe` 설치 파일이 있습니다.

워크플로 정의: [`.github/workflows/electron-build-windows.yml`](.github/workflows/electron-build-windows.yml)

## 저장 위치

노트는 **로컬 .md 파일**로 저장됩니다.

- 경로: `app.getPath('userData')/notes`
  - macOS: `~/Library/Application Support/note-app/notes`
  - Windows: `%APPDATA%/note-app/notes`
  - Linux: `~/.config/note-app/notes`

## 앱 아이콘

- 원본 벡터: `build/icon-source.svg` (iOS 스쿼클 느낌의 둥근 틸 배경 + 작은 흰 노트)
- **`npm run render-icon`** (맥에서): `sharp`로 `build/icon.png`·`public/favicon.png` 생성 후, `iconutil`로 **`build/icon.icns`** 까지 만듭니다.
- **패키징(macOS):** `build.mac.icon` → `build/icon.icns`. **Finder / 응용 프로그램**에 보이는 아이콘은 **`release/…/Note App.app`** 처럼 **electron-builder로 만든 .app** 기준입니다.
- **`npm run electron:dev`로만 실행할 때:** 실제로 뜨는 것은 `node_modules/electron` 안의 **Electron.app** 이라, **Finder에서 보면 Electron 기본 아이콘**인 것이 정상입니다. Dock에는 `app.dock.setIcon`으로 우리 아이콘이 보일 수 있습니다.

## 구조

- `electron/main.ts` — 메인 프로세스, 창 생성 및 노트 파일 읽기/쓰기 IPC
- `electron/preload.ts` — `window.electronAPI.notes` 브릿지
- `src/` — React UI (노트 목록 + 마크다운 텍스트 에디터)
