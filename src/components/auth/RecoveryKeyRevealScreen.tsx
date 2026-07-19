import { useState } from 'react';
import { downloadRecoveryKeyImage } from '../../lib/crypto';
import './auth.css';

interface RecoveryKeyRevealScreenProps {
  recoveryKey: string;
  email?: string | null;
  onContinue: () => void;
}

export function RecoveryKeyRevealScreen({
  recoveryKey,
  email,
  onContinue,
}: RecoveryKeyRevealScreenProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="auth recovery-reveal">
      <div className="auth-brand">
        <h1>PayDay</h1>
        <p>복구 키를 저장하세요</p>
      </div>

      <p className="auth-message">
        비밀번호를 잊었을 때 이 키로 암호화된 메모를 복구할 수 있습니다.
        서버에는 저장되지 않으며, 분실 시 복구할 수 없습니다.
      </p>

      <div className="recovery-key-box">
        <code>{recoveryKey}</code>
      </div>

      <div className="account-actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="auth-btn"
          onClick={() => downloadRecoveryKeyImage(recoveryKey, email)}
        >
          이미지로 다운로드
        </button>
        <button type="button" className="auth-btn ghost" onClick={handleCopy}>
          {copied ? '복사됨' : '텍스트 복사'}
        </button>
      </div>

      <label className={`recovery-confirm ${confirmed ? 'is-checked' : ''}`}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="recovery-confirm-mark" aria-hidden />
        <span className="recovery-confirm-text">복구 키를 안전한 곳에 저장했습니다</span>
      </label>

      <button
        type="button"
        className="auth-btn"
        disabled={!confirmed}
        onClick={onContinue}
        style={{ marginTop: 12 }}
      >
        캘린더로 이동
      </button>
    </div>
  );
}
