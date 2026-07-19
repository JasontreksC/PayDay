import { useState, type FormEvent } from 'react';
import { useCrypto } from '../../contexts/CryptoContext';
import '../auth/auth.css';

interface RecoveryKeyScreenProps {
  onBack: () => void;
}

export function RecoveryKeyScreen({ onBack }: RecoveryKeyScreenProps) {
  const { reissueRecoveryKey } = useCrypto();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReissue = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const message = await reissueRecoveryKey(password);
    if (message) setError(message);

    setSubmitting(false);
  };

  return (
    <div className="account">
      <div className="account-header">
        <button type="button" className="account-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2 className="account-title">복구 키 재발급</h2>
      </div>

      <div className="account-card">
        <p className="account-email" style={{ fontSize: 14, lineHeight: 1.55 }}>
          새 복구 키를 생성합니다. 이전에 받은 복구 키는 더 이상 사용할 수 없습니다.
          본인 확인을 위해 비밀번호를 입력해 주세요.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleReissue}>
        <div className="auth-field">
          <label htmlFor="reissue-password">비밀번호</label>
          <input
            id="reissue-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="account-actions">
          <button type="submit" className="auth-btn danger" disabled={submitting}>
            새 복구 키 발급
          </button>
        </div>
      </form>
    </div>
  );
}
