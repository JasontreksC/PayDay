import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './auth.css';

export function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    const authError = await updatePassword(password);
    if (authError) setError(authError.message);
    setSubmitting(false);
  };

  return (
    <div className="auth">
      <div className="auth-brand">
        <h1>PayDay</h1>
        <p>새 비밀번호 설정</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="password">새 비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="confirm">비밀번호 확인</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          변경하기
        </button>
      </form>
    </div>
  );
}
