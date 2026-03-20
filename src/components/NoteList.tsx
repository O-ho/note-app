import type { NoteItem } from '../vite-env.d';
import './NoteList.css';

type Props = {
  notes: NoteItem[];
  currentId: string | null;
  onSelect: (note: NoteItem) => void;
  onDelete: (id: string) => void;
  /** true면 노트 전환(저장·로드) 중 — 다른 항목 클릭 방지 */
  disabled?: boolean;
};

export function NoteList({ notes, currentId, onSelect, onDelete, disabled = false }: Props) {
  return (
    <ul className={`note-list${disabled ? ' note-list--busy' : ''}`} aria-busy={disabled}>
      {notes.map((note) => (
        <li key={note.id} className={currentId === note.id ? 'active' : ''}>
          <button
            type="button"
            className="note-item-btn"
            disabled={disabled}
            onClick={() => onSelect(note)}
          >
            <span className="note-item-title">{note.title}</span>
          </button>
          <button
            type="button"
            className="note-item-delete"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              const label = note.title || '이 노트';
              const ok = window.confirm(
                `「${label}」 노트를 삭제할까요?\n삭제한 내용은 복구할 수 없습니다.`
              );
              if (ok) onDelete(note.id);
            }}
            title="삭제"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
