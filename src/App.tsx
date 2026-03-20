import { useState, useEffect, useCallback, useRef } from 'react';
import type { NoteItem } from '@/vite-env';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

const hasNotesAPI = typeof window !== 'undefined' && window.electronAPI?.notes;
const hasAppAPI = typeof window !== 'undefined' && window.electronAPI?.app;

/** 마지막 입력 후 이 시간( ms ) 뒤 디스크에 자동 저장 */
const AUTO_SAVE_MS = 2000;

/** 저장이 순식간에 끝나도 '저장 중…'이 잠깐은 보이도록 최소 표시 시간 */
const MIN_SAVE_INDICATOR_MS = 750;

/** 노트 본문에서 첫 번째 # 제목 줄을 파싱해 제목 문자열 반환 */
function getTitleFromContent(content: string): string {
  const firstLine = content.trimStart().split('\n')[0] ?? '';
  const match = firstLine.match(/^#\s+(.+)$/);
  return match ? match[1].trim() : '';
}

/** 메인 프로세스 safeFilename과 동일한 정규화 (제목 비교용) */
function normalizeTitle(title: string): string {
  return title.replace(/[^a-zA-Z0-9가-힣_\-\s.]/g, '_').trim() || 'note';
}

export default function App() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [current, setCurrent] = useState<NoteItem | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 다른 노트로 저장 후 이동 중 — 연속 클릭 시 레이스 방지 */
  const [switchingNote, setSwitchingNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingCountRef = useRef(0);
  const savingIndicatorShownAtRef = useRef<number | null>(null);
  const saveIndicatorHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef(current);
  const contentRef = useRef(content);
  const skipDebounceAfterLoadRef = useRef(false);

  currentRef.current = current;
  contentRef.current = content;

  const clearAutoSaveTimer = () => {
    if (autoSaveTimerRef.current !== null) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  };

  const loadList = useCallback(async () => {
    if (!hasNotesAPI) {
      setLoading(false);
      return;
    }
    try {
      const list = await window.electronAPI!.notes.list();
      setNotes(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    return () => {
      if (saveIndicatorHideTimeoutRef.current !== null) {
        clearTimeout(saveIndicatorHideTimeoutRef.current);
      }
    };
  }, []);

  const scheduleSaveIndicatorHide = useCallback(() => {
    const started = savingIndicatorShownAtRef.current;
    savingIndicatorShownAtRef.current = null;
    const elapsed = started != null ? Date.now() - started : 0;
    const remaining = Math.max(0, MIN_SAVE_INDICATOR_MS - elapsed);
    if (saveIndicatorHideTimeoutRef.current !== null) {
      clearTimeout(saveIndicatorHideTimeoutRef.current);
    }
    saveIndicatorHideTimeoutRef.current = setTimeout(() => {
      saveIndicatorHideTimeoutRef.current = null;
      setIsSaving(false);
    }, remaining);
  }, []);

  const persistNote = useCallback(
    async (note: NoteItem, body: string): Promise<boolean> => {
      savingCountRef.current += 1;
      if (savingCountRef.current === 1) {
        if (saveIndicatorHideTimeoutRef.current !== null) {
          clearTimeout(saveIndicatorHideTimeoutRef.current);
          saveIndicatorHideTimeoutRef.current = null;
        }
        setIsSaving(true);
        savingIndicatorShownAtRef.current = Date.now();
      }
      try {
        if (!hasNotesAPI) return false;
        const parsedTitle = getTitleFromContent(body) || note.title;
        const titleChanged = normalizeTitle(parsedTitle) !== normalizeTitle(note.title);

        try {
          if (titleChanged) {
            const created = await window.electronAPI!.notes.create(parsedTitle);
            await window.electronAPI!.notes.save(created.id, body);
            await window.electronAPI!.notes.delete(note.id);
            setCurrent({ id: created.id, title: parsedTitle });
          } else {
            const updated = await window.electronAPI!.notes.save(note.id, body);
            setCurrent(updated);
          }
          await loadList();
          return true;
        } catch (e) {
          console.error('persistNote error:', e);
          return false;
        }
      } finally {
        savingCountRef.current -= 1;
        if (savingCountRef.current < 0) savingCountRef.current = 0;
        if (savingCountRef.current === 0) {
          scheduleSaveIndicatorHide();
        }
      }
    },
    [loadList, scheduleSaveIndicatorHide]
  );

  /** setContent 전에 ref 동기화 — 저장/노트 전환 시 최신 본문 보장 */
  const updateContent = useCallback((value: string) => {
    contentRef.current = value;
    setContent(value);
  }, []);

  const scheduleAutoSave = useCallback(() => {
    clearAutoSaveTimer();
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      const n = currentRef.current;
      const body = contentRef.current;
      if (n) void persistNote(n, body);
    }, AUTO_SAVE_MS);
  }, [persistNote]);

  const selectNote = useCallback(
    async (note: NoteItem) => {
      if (currentRef.current?.id === note.id) return;
      if (switchingNote) return;

      setSwitchingNote(true);
      try {
        clearAutoSaveTimer();
        const previous = currentRef.current;
        const body = contentRef.current;
        if (hasNotesAPI && previous) {
          const ok = await persistNote(previous, body);
          if (!ok) return;
        }

        skipDebounceAfterLoadRef.current = true;
        if (!hasNotesAPI) {
          setCurrent(note);
          updateContent('');
          return;
        }
        try {
          const text = await window.electronAPI!.notes.read(note.id);
          // current / content 를 한 번에 맞춰야 자동저장이 잘못된 파일에 쓰이지 않음
          setCurrent(note);
          updateContent(text);
        } catch {
          setCurrent(note);
          updateContent('');
        }
      } finally {
        setSwitchingNote(false);
      }
    },
    [persistNote, updateContent, switchingNote]
  );

  const saveCurrent = useCallback(async () => {
    clearAutoSaveTimer();
    const n = currentRef.current;
    if (!n || !hasNotesAPI) return;
    await persistNote(n, contentRef.current);
  }, [persistNote]);

  /** 입력 멈춘 뒤 자동 저장 (노트 전환 직후 한 번은 스킵) */
  useEffect(() => {
    if (!current) {
      clearAutoSaveTimer();
      return;
    }
    if (skipDebounceAfterLoadRef.current) {
      skipDebounceAfterLoadRef.current = false;
      return;
    }
    scheduleAutoSave();
    return () => clearAutoSaveTimer();
    // current 객체는 저장 후 setCurrent(updated)마다 새 참조라서 넣으면 내용이 같아도 매번 타이머가 재설정됨 → id만 구독
  }, [content, current?.id, scheduleAutoSave]);

  /** 다른 앱으로 전환·창 포커스 잃을 때 즉시 저장 */
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && currentRef.current) {
        clearAutoSaveTimer();
        void persistNote(currentRef.current, contentRef.current);
      }
    };
    const flushOnBlur = () => {
      if (currentRef.current) {
        clearAutoSaveTimer();
        void persistNote(currentRef.current, contentRef.current);
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('blur', flushOnBlur);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('blur', flushOnBlur);
    };
  }, [persistNote]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void saveCurrent();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveCurrent]);

  const createNote = useCallback(async () => {
    if (!hasNotesAPI) return;
    try {
      const created = await window.electronAPI!.notes.create('새 노트');
      setNotes((prev) => [created, ...prev]);
      await selectNote(created);
    } catch (e) {
      console.error(e);
    }
  }, [selectNote]);

  const deleteNote = useCallback(
    async (id: string) => {
      if (!hasNotesAPI) return;
      clearAutoSaveTimer();
      try {
        await window.electronAPI!.notes.delete(id);
        if (current?.id === id) {
          setCurrent(null);
          updateContent('');
        }
        await loadList();
      } catch (e) {
        console.error(e);
      }
    },
    [current?.id, loadList, updateContent]
  );

  if (!hasNotesAPI) {
    return (
      <div className="app">
        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>이 앱은 Electron 환경에서 실행해야 합니다.</p>
          <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>
            터미널에서 <code>npm run electron:dev</code> 를 실행해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="sidebar-header-row">
            <h1>노트</h1>
            {hasAppAPI && (
              <button
                type="button"
                className="btn-settings"
                onClick={() => setSettingsOpen(true)}
                title="설정"
              >
                ⚙ 설정
              </button>
            )}
          </div>
          <button type="button" className="btn-add" onClick={createNote}>
            + 새 노트
          </button>
        </header>
        {hasAppAPI && (
          <SettingsModal
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            getSettings={() => window.electronAPI!.app.getSettings()}
            setGeminiKey={(key) => window.electronAPI!.app.setGeminiKey(key)}
          />
        )}
        {loading ? (
          <p className="sidebar-loading">로딩 중...</p>
        ) : (
          <NoteList
            notes={notes}
            currentId={current?.id ?? null}
            onSelect={selectNote}
            onDelete={deleteNote}
            disabled={switchingNote}
          />
        )}
      </aside>
      <main className="editor-area">
        {current ? (
          <NoteEditor
            title={getTitleFromContent(content) || current.title}
            content={content}
            onChange={updateContent}
            onSave={saveCurrent}
            isSaving={isSaving}
            onImproveReadability={
              window.electronAPI?.ai?.improveReadability
                ? (text) => window.electronAPI!.ai!.improveReadability(text)
                : undefined
            }
            onPolishDeveloperDoc={
              window.electronAPI?.ai?.polishDeveloperDoc
                ? (text) => window.electronAPI!.ai!.polishDeveloperDoc(text)
                : undefined
            }
          />
        ) : (
          <div className="empty-state">
            <p>노트를 선택하거나 새 노트를 만드세요.</p>
          </div>
        )}
      </main>
    </div>
  );
}
