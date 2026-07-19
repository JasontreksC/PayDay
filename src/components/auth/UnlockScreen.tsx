import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import './auth.css';

export function UnlockScreen() {
  const { user, signOut } = useAuth();
  const { unlockWithPassword, unlockError } = useCrypto();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const message = await unlockWithPassword(password);
    if (message) setError(message);

    setSubmitting(false);
  };

  return (
    <div className="auth">
      <div className="auth-brand">
        <h1>PayDay</h1>
        <p>메모 암호 잠금 해제</p>
      </div>
      <p className="auth-muted">{user?.email}</p>
      <p className="auth-message" style={{ marginTop: 12 }}>
        로그인 비밀번호로 암호화 키를 복원합니다.
        키는 이 브라우저에만 보관됩니다.
      </p>
      <form className="auth-form" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="auth-field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {(error || unlockError) && <p className="auth-error">{error || unlockError}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          잠금 해제
        </button>
        <button type="button" className="auth-btn ghost" onClick={signOut}>
          로그아웃
        </button>
      </form>
    </div>
  );
}
