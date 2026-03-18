import { useState, useEffect, useCallback } from 'react';
import type { NoteItem } from './vite-env.d';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

const hasNotesAPI = typeof window !== 'undefined' && window.electronAPI?.notes;
const hasAppAPI = typeof window !== 'undefined' && window.electronAPI?.app;

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

  const selectNote = useCallback(async (note: NoteItem) => {
    setCurrent(note);
    if (!hasNotesAPI) return;
    try {
      const text = await window.electronAPI!.notes.read(note.id);
      setContent(text);
    } catch {
      setContent('');
    }
  }, []);

  const saveCurrent = useCallback(async () => {
    if (!current || !hasNotesAPI) return;
    const parsedTitle = getTitleFromContent(content) || current.title;
    const titleChanged = normalizeTitle(parsedTitle) !== normalizeTitle(current.title);

    try {
      if (titleChanged) {
        // 새 파일 생성 → 저장 → 기존 삭제 순서로 해서 실패 시 데이터 손실 방지
        const created = await window.electronAPI!.notes.create(parsedTitle);
        await window.electronAPI!.notes.save(created.id, content);
        await window.electronAPI!.notes.delete(current.id);
        setCurrent({ id: created.id, title: parsedTitle });
      } else {
        const updated = await window.electronAPI!.notes.save(current.id, content);
        setCurrent(updated);
      }
      await loadList();
    } catch (e) {
      console.error('saveCurrent error:', e);
    }
  }, [current, content, loadList]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (current) saveCurrent();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, saveCurrent]);

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
      try {
        await window.electronAPI!.notes.delete(id);
        if (current?.id === id) {
          setCurrent(null);
          setContent('');
        }
        await loadList();
      } catch (e) {
        console.error(e);
      }
    },
    [current?.id, loadList]
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
          />
        )}
      </aside>
      <main className="editor-area">
        {current ? (
          <NoteEditor
            title={getTitleFromContent(content) || current.title}
            content={content}
            onChange={setContent}
            onSave={saveCurrent}
            onImproveReadability={
              window.electronAPI?.ai?.improveReadability
                ? (text) => window.electronAPI!.ai!.improveReadability(text)
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
