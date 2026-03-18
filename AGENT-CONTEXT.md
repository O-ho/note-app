# Electron 노트 앱 작업 정리 (Agent 전달용)

> Repo 이전 후 에이전트에 전달할 때 이 문서를 함께 주면 이어서 작업하기 좋습니다.

---

## 1. 프로젝트 개요

- **목표**: Electron + React + TypeScript로 **로컬 .md 파일**에 저장되는 나만의 노트 앱
- **저장 방식**: 메인 프로세스에서 `fs`로 `userData/notes` 폴더에 `.md` 파일 생성/읽기/쓰기. 렌더러는 preload를 통해 IPC로만 접근.

---

## 2. 기술 스택

| 구분 | 선택 |
|------|------|
| 런타임 | Electron |
| 프론트 | React 18 + TypeScript |
| 번들러 | Vite 5 |
| 스타일 | 순수 CSS (다크 테마) |
| 저장 | 로컬 .md 파일 (메인 프로세스 `fs`) |

---

## 3. 프로젝트 구조

```
note-app/
├── package.json              # main: "dist-electron/main.js"
├── tsconfig.json             # React/Vite용
├── tsconfig.electron.json    # Electron 메인/프리로드용
├── vite.config.ts
├── index.html                # Vite 진입점
├── AGENT-CONTEXT.md          # 이 문서
├── README.md
├── electron/
│   ├── main.ts               # 메인 프로세스: 창 생성 + 노트 IPC 핸들러
│   └── preload.ts            # contextBridge → window.electronAPI.notes
├── src/
│   ├── main.tsx
│   ├── App.tsx / App.css
│   ├── index.css
│   ├── vite-env.d.ts         # window.electronAPI 타입 선언
│   └── components/
│       ├── NoteList.tsx / NoteList.css
│       └── NoteEditor.tsx / NoteEditor.css
├── dist/                     # Vite 빌드 결과 (프로덕션 로드용)
└── dist-electron/            # main.js, preload.js (tsc로 컴파일)
```

---

## 4. 구현된 기능

### 4.1 메인 프로세스 (`electron/main.ts`)

- **노트 디렉터리**: `app.getPath('userData') + '/notes'` (없으면 생성)
- **IPC 핸들러** (모두 `app.whenReady()` 이후 `registerIpcHandlers()` 안에서 등록):
  - `notes:list` → 디렉터리 내 `.md` 파일 목록 `{ id, title }[]` 반환
  - `notes:read` → `filename`으로 내용 문자열 반환
  - `notes:save` → `filename`, `content`로 .md 저장 후 `{ id, title }` 반환
  - `notes:create` → `title`로 새 .md 생성 (중복 시 `_1`, `_2` 접미사), 초기 내용 `# 제목\n\n`
  - `notes:delete` → `filename`에 해당 .md 삭제
- **창**: 개발 시 `http://localhost:5173` 로드, 프로덕션 시 `dist/index.html` 로드. preload는 `dist-electron/preload.js`.

### 4.2 프리로드 (`electron/preload.ts`)

- `contextBridge.exposeInMainWorld('electronAPI', { notes: { list, read, save, create, delete } })`
- 렌더러는 `window.electronAPI.notes.*` 로만 접근 (nodeIntegration 비활성화).

### 4.3 React UI

- **App.tsx**: 노트 목록 상태, 현재 선택 노트, 내용 상태. `loadList` / `selectNote` / `saveCurrent` / `createNote` / `deleteNote` 로 IPC 호출.
- **NoteList**: 사이드바 목록, 선택 시 `onSelect`, 삭제 버튼 시 `onDelete`.
- **NoteEditor**: 제목 표시, textarea로 마크다운 편집, “저장” 버튼으로 `onSave` 호출.
- 에디터는 단순 textarea이며, 마크다운 미리보기/하이라이트는 미구현.

---

## 5. npm 스크립트

| 스크립트 | 설명 |
|----------|------|
| `npm run dev` | Vite 개발 서버만 (프론트만 확인 시) |
| `npm run build:electron` | `tsc -p tsconfig.electron.json` → `dist-electron/` 생성 |
| `npm run build` | `build:electron` 후 `vite build` → `dist/` 생성 |
| `npm run electron:dev` | `build:electron` 후 `concurrently "npm run dev" "wait-on http://localhost:5173 && electron ."` |
| `npm run electron:build` | `npm run build` 후 `electron-builder` (실행 파일은 `release/`) |

---

## 6. 알려진 이슈 (실행 환경)

- **증상**: `require('electron')`이 `app`/`BrowserWindow`가 아닌 **실행 파일 경로 문자열**을 반환해, `app.whenReady()` 호출 시 `Cannot read properties of undefined (reading 'whenReady')` 발생.
- **원인**: 이 프로젝트를 Cursor/IDE 내장 터미널에서 실행할 때, 메인 프로세스에서 `require('electron')`이 npm 패키지의 `index.js`(경로 문자열 반환)를 로드하는 것으로 확인됨.
- **권장**: **시스템 터미널**(macOS Terminal, iTerm 등)에서 `cd note-app && npm run electron:dev` 실행. Repo 이전 후 새 환경에서도 동일 현상이면 터미널/IDE 환경을 바꿔서 시도하거나, [Electron Forge](https://www.electronforge.io/) 등 공식 템플릿으로 재구성하는 것도 방법.

---

## 7. Repo 이전 후 할 일 (선택)

- [ ] 새 경로에서 `npm install` 후 위 스크립트로 실행 확인.
- [ ] `app` undefined 이슈가 계속되면: 터미널 변경 또는 Electron Forge/Vite 공식 템플릿으로 메인 진입점 재구성 검토.
- [ ] 기능 확장: 마크다운 미리보기, 자동 저장, 노트 제목 변경, 노트 폴더/태그 등은 요구사항 정리 후 구현 가능.

---

## 8. 저장 경로 참고

- **macOS**: `~/Library/Application Support/note-app/notes`
- **Windows**: `%APPDATA%/note-app/notes`
- **Linux**: `~/.config/note-app/notes`

이 문서는 `note-app/AGENT-CONTEXT.md` 에 있으며, repo 이전 시 함께 옮기면 됩니다.
