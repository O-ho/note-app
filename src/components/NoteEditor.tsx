import { useState, useRef, useLayoutEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { DOC_POLISH_PREVIEW_AFTER, DOC_POLISH_PREVIEW_BEFORE } from '../docPolishPreview';
import './NoteEditor.css';

const INDENT = '  ';

function getLineBounds(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  const nextNl = text.indexOf('\n', pos);
  const end = nextNl === -1 ? text.length : nextNl;
  return { start, end };
}

/** ⌘X 줄 삭제: 제거 구간 [from, to) + 클립보드에 넣을 줄 텍스트 */
function getLineDeleteRange(value: string, pos: number): { from: number; to: number; clipboardLine: string } {
  const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const nextNl = value.indexOf('\n', lineStart);
  const hasNlAfter = nextNl !== -1;
  const lineEnd = hasNlAfter ? nextNl : value.length;
  const lineText = value.slice(lineStart, lineEnd);
  if (hasNlAfter) {
    return { from: lineStart, to: nextNl + 1, clipboardLine: `${lineText}\n` };
  }
  if (lineStart === lineEnd && lineStart > 0) {
    return { from: lineStart - 1, to: lineEnd, clipboardLine: '' };
  }
  return { from: lineStart, to: lineEnd, clipboardLine: lineText };
}

function leadingWhitespace(line: string): string {
  const m = line.match(/^[\t ]*/);
  return m ? m[0] : '';
}

function lineRangeForBlock(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const toNl = value.indexOf('\n', Math.max(0, end - 1));
  const to = toNl === -1 ? value.length : toNl;
  return { from, to };
}

function unindentLineStart(line: string): { line: string; removed: number } {
  if (line.startsWith('  ')) return { line: line.slice(2), removed: 2 };
  if (line.startsWith('\t')) return { line: line.slice(1), removed: 1 };
  return { line, removed: 0 };
}

/** 열 문자 → 닫는 문자 (자동 완성) */
const AUTO_CLOSE_PAIRS: Record<string, string> = {
  '"': '"',
  '{': '}',
  '[': ']',
  '(': ')',
};
const AUTO_CLOSE_VALUES = new Set(Object.values(AUTO_CLOSE_PAIRS));

type Props = {
  title: string;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  /** 디스크 저장 중(자동·수동·노트 전환 등) */
  isSaving?: boolean;
  /** Few-shot 기반 가독성 변환 (없으면 버튼 비표시) */
  onImproveReadability?: (text: string) => Promise<string>;
  /** 개발 문서체 다듬기 (README·API 문서 등, 없으면 버튼 비표시) */
  onPolishDeveloperDoc?: (text: string) => Promise<string>;
};

export function NoteEditor({
  title,
  content,
  onChange,
  onSave,
  isSaving = false,
  onImproveReadability,
  onPolishDeveloperDoc,
}: Props) {
  const [isImproving, setIsImproving] = useState(false);
  const [isPolishingDoc, setIsPolishingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(false);
  const [docPolishExampleOpen, setDocPolishExampleOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const sel = selectionRef.current;
    const el = textareaRef.current;
    if (sel && el) {
      el.setSelectionRange(sel.start, sel.end);
      selectionRef.current = null;
    }
  }, [content]);

  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    const value = content;

    const noMods = !e.ctrlKey && !e.metaKey && !e.altKey;
    const composing = (e.nativeEvent as globalThis.KeyboardEvent).isComposing;

    /** ⌘X / Ctrl+X (선택 없음): 현재 줄 삭제(잘라내기처럼 클립보드에도 복사) */
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      !e.shiftKey &&
      !composing &&
      (e.key === 'x' || e.key === 'X') &&
      start === end
    ) {
      const { from, to, clipboardLine } = getLineDeleteRange(value, start);
      if (from >= to) return;
      e.preventDefault();
      void navigator.clipboard?.writeText(clipboardLine).catch(() => {});
      const next = value.slice(0, from) + value.slice(to);
      const newCaret = Math.min(from, Math.max(0, next.length));
      selectionRef.current = { start: newCaret, end: newCaret };
      onChange(next);
      return;
    }

    if (noMods && !composing && e.key === 'Backspace' && start === end && start > 0) {
      const open = value[start - 1];
      const close = AUTO_CLOSE_PAIRS[open];
      if (close && value[start] === close) {
        e.preventDefault();
        const next = value.slice(0, start - 1) + value.slice(start + 1);
        selectionRef.current = { start: start - 1, end: start - 1 };
        onChange(next);
        return;
      }
    }

    if (noMods && !composing && AUTO_CLOSE_VALUES.has(e.key) && start === end && value[start] === e.key) {
      e.preventDefault();
      const pos = start + 1;
      requestAnimationFrame(() => textareaRef.current?.setSelectionRange(pos, pos));
      return;
    }

    if (noMods && !composing) {
      const closer = AUTO_CLOSE_PAIRS[e.key];
      if (closer && e.key.length === 1) {
        e.preventDefault();
        const mid = value.slice(start, end);
        const next = value.slice(0, start) + e.key + mid + closer + value.slice(end);
        const caret = start + 1 + mid.length;
        selectionRef.current = { start: caret, end: caret };
        onChange(next);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start !== end) {
        const { from, to } = lineRangeForBlock(value, start, end);
        const block = value.slice(from, to);
        const lines = block.split('\n');
        const linesBefore = (value.slice(from, start).match(/\n/g) || []).length;

        if (e.shiftKey) {
          const newLines = lines.map((ln) => unindentLineStart(ln).line);
          const newBlock = newLines.join('\n');
          let p = from;
          let newStart = start;
          let newEnd = end;
          for (let i = 0; i < lines.length; i++) {
            const r = lines[i].length - newLines[i].length;
            const ls = p;
            const le = p + lines[i].length;
            if (start > le) newStart -= r;
            else if (start > ls) newStart -= Math.min(r, start - ls);
            if (end > le) newEnd -= r;
            else if (end > ls) newEnd -= Math.min(r, end - ls);
            p = le + 1;
          }
          newStart = Math.max(from, newStart);
          newEnd = Math.max(newStart, newEnd);
          selectionRef.current = { start: newStart, end: newEnd };
          onChange(value.slice(0, from) + newBlock + value.slice(to));
          return;
        }

        const newBlock = lines.map((ln) => INDENT + ln).join('\n');
        const newStart = start + INDENT.length * (linesBefore + 1);
        const newEnd = end + INDENT.length * lines.length;
        selectionRef.current = { start: newStart, end: newEnd };
        onChange(value.slice(0, from) + newBlock + value.slice(to));
        return;
      }
      const next = value.slice(0, start) + INDENT + value.slice(end);
      selectionRef.current = { start: start + INDENT.length, end: start + INDENT.length };
      onChange(next);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const { start: lineStart, end: lineEnd } = getLineBounds(value, start);
      const atLineEnd = start === lineEnd && end === start;
      const line = value.slice(lineStart, lineEnd);
      if (atLineEnd && /^\s*```[\w-]*\s*$/.test(line)) {
        e.preventDefault();
        const indent = leadingWhitespace(line);
        const insert = `\n${indent}\n${indent}\`\`\``;
        const next = value.slice(0, start) + insert + value.slice(start);
        const caret = start + 1 + indent.length + 1;
        selectionRef.current = { start: caret, end: caret };
        onChange(next);
        return;
      }
      if (start === end) {
        const prefix = leadingWhitespace(line);
        if (prefix.length > 0) {
          e.preventDefault();
          const insert = `\n${prefix}`;
          const next = value.slice(0, start) + insert + value.slice(start);
          const caret = start + insert.length;
          selectionRef.current = { start: caret, end: caret };
          onChange(next);
          return;
        }
      }
    }
  };

  const aiBusy = isImproving || isPolishingDoc;

  const handleImprove = async () => {
    if (!content.trim() || !onImproveReadability) return;
    setError(null);
    setIsImproving(true);
    try {
      const result = await onImproveReadability(content);
      onChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가독성 변환에 실패했습니다.');
    } finally {
      setIsImproving(false);
    }
  };

  const handlePolishDoc = async () => {
    if (!content.trim() || !onPolishDeveloperDoc) return;
    setError(null);
    setIsPolishingDoc(true);
    try {
      const result = await onPolishDeveloperDoc(content);
      onChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '문서 다듬기에 실패했습니다.');
    } finally {
      setIsPolishingDoc(false);
    }
  };

  return (
    <div className={`note-editor ${splitView ? 'note-editor--split' : ''}`}>
      <header className="editor-header">
        <h2 className="editor-title">{title}</h2>
        <div className="editor-actions">
          <button
            type="button"
            className={`btn-split ${splitView ? 'is-active' : ''}`}
            onClick={() => setSplitView((v) => !v)}
            title={splitView ? '미리보기 닫기' : '마크다운 미리보기 열기'}
          >
            분할
          </button>
          {onImproveReadability && (
            <button
              type="button"
              className="btn-improve"
              onClick={handleImprove}
              disabled={aiBusy || !content.trim()}
              title="AI가 노트를 읽기 좋게 정리합니다 (Few-shot)"
            >
              {isImproving ? '변환 중…' : '가독성 변환'}
            </button>
          )}
          {onPolishDeveloperDoc && (
            <button
              type="button"
              className="btn-doc-polish"
              onClick={handlePolishDoc}
              disabled={aiBusy || !content.trim()}
              title="README·API 문서처럼 문장을 문서체로 다듬습니다 (Few-shot)"
            >
              {isPolishingDoc ? '다듬는 중…' : '문서 다듬기'}
            </button>
          )}
          <button
            type="button"
            className="btn-save"
            onClick={() => void onSave()}
            disabled={isSaving}
            aria-busy={isSaving}
            title={isSaving ? '저장 중…' : '저장 (⌘S)'}
          >
            {isSaving ? (
              '저장 중…'
            ) : (
              <>
                저장 <kbd className="shortcut-hint">⌘S</kbd>
              </>
            )}
          </button>
        </div>
      </header>
      {onPolishDeveloperDoc && (
        <details
          className="doc-polish-example"
          open={docPolishExampleOpen}
          onToggle={(e) => setDocPolishExampleOpen(e.currentTarget.open)}
        >
          <summary>개발 문서 다듬기 예시 (테스트 문장 전·후)</summary>
          <p className="doc-polish-example-hint">
            아래는 프롬프트 few-shot과 동일한 예시입니다. 실제 노트에 적용하면 Gemini가 비슷한
            톤으로 다듬습니다.
          </p>
          <div className="doc-polish-example-grid">
            <div className="doc-polish-example-col">
              <span className="doc-polish-example-label">다듬기 전</span>
              <pre className="doc-polish-example-pre">{DOC_POLISH_PREVIEW_BEFORE}</pre>
            </div>
            <div className="doc-polish-example-col">
              <span className="doc-polish-example-label">다듬은 뒤 (예시)</span>
              <div className="doc-polish-example-after">
                <MarkdownPreview content={DOC_POLISH_PREVIEW_AFTER} />
              </div>
            </div>
          </div>
        </details>
      )}
      {error && (
        <div className="editor-error" role="alert">
          {error}
        </div>
      )}
      <div className="editor-body">
        <div className="editor-pane">
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            placeholder="마크다운으로 작성하세요… (``` 후 Enter → 코드블록)"
            spellCheck={false}
          />
        </div>
        {splitView && (
          <>
            <div className="editor-split-divider" />
            <div className="preview-pane">
              <MarkdownPreview content={content} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
