import { useState, useEffect } from 'react';
import './SettingsModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  getSettings: () => Promise<{ geminiApiKey?: string }>;
  setGeminiKey: (key: string) => Promise<void>;
};

export function SettingsModal({ isOpen, onClose, getSettings, setGeminiKey }: Props) {
  const [geminiKey, setGeminiKeyLocal] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'ok' | 'error' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      getSettings().then((s) => {
        setHasSavedKey(!!s.geminiApiKey?.trim());
        setGeminiKeyLocal('');
      });
    }
  }, [isOpen, getSettings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setGeminiKey(geminiKey);
      setHasSavedKey(!!geminiKey.trim());
      setGeminiKeyLocal('');
      setMessage('ok');
    } catch {
      setMessage('error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h3>설정</h3>
          <button type="button" className="settings-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className="settings-body">
          <label className="settings-label">
            Gemini API 키
            {hasSavedKey && <span className="settings-hint">(저장된 키 있음)</span>}
          </label>
          <input
            type="password"
            className="settings-input"
            value={geminiKey}
            onChange={(e) => setGeminiKeyLocal(e.target.value)}
            placeholder="Google AI Studio에서 발급한 API 키 입력"
            autoComplete="off"
          />
          <p className="settings-desc">
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              Google AI Studio
            </a>
            에서 무료로 발급할 수 있습니다. 가독성 변환 기능에 사용됩니다.
          </p>
          {message === 'ok' && <p className="settings-msg settings-msg--ok">저장되었습니다.</p>}
          {message === 'error' && (
            <p className="settings-msg settings-msg--err">저장에 실패했습니다.</p>
          )}
        </div>
        <footer className="settings-footer">
          <button type="button" className="btn-save-settings" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
