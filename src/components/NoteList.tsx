import type { NoteItem } from '../vite-env.d';
import './NoteList.css';

type Props = {
  notes: NoteItem[];
  currentId: string | null;
  onSelect: (note: NoteItem) => void;
  onDelete: (id: string) => void;
};

export function NoteList({ notes, currentId, onSelect, onDelete }: Props) {
  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id} className={currentId === note.id ? 'active' : ''}>
          <button
            type="button"
            className="note-item-btn"
            onClick={() => onSelect(note)}
          >
            <span className="note-item-title">{note.title}</span>
          </button>
          <button
            type="button"
            className="note-item-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
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
