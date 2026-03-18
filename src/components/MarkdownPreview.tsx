import ReactMarkdown from 'react-markdown';
import './MarkdownPreview.css';

type Props = {
  content: string;
  className?: string;
};

export function MarkdownPreview({ content, className = '' }: Props) {
  return (
    <div className={`markdown-preview ${className}`}>
      <ReactMarkdown>{content || '_내용 없음_'}</ReactMarkdown>
    </div>
  );
}
