import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import '../auth/auth.css';

interface AccountSettingsProps {
  onBack: () => void;
}

export function AccountSettings({ onBack }: AccountSettingsProps) {
  const { user, signOut, updatePassword, deleteAccount } = useAuth();
  const { verifyVaultPassword, rewrapVaultWithPassword } = useCrypto();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 인증 비밀번호는 바뀌었지만 암호 키 재래핑이 실패한 상태.
  // 이때는 재제출 시 재래핑만 다시 시도한다.
  const [pendingRewrap, setPendingRewrap] = useState(false);

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);

    if (!pendingRewrap) {
      // 인증 비밀번호를 바꾸기 전에 현재 비밀번호로 암호 키를 열 수 있는지
      // 먼저 확인해, 두 단계가 어긋난 상태로 남는 것을 막는다.
      const verifyError = await verifyVaultPassword(currentPassword);
      if (verifyError) {
        setError(verifyError);
        setSubmitting(false);
        return;
      }

      const authError = await updatePassword(password);
      if (authError) {
        setError(authError.message);
        setSubmitting(false);
        return;
      }
    }

    const cryptoError = await rewrapVaultWithPassword(currentPassword, password);
    if (cryptoError) {
      setPendingRewrap(true);
      setError(`${cryptoError} 비밀번호는 이미 변경되었으니 같은 값으로 다시 시도해 주세요.`);
    } else {
      setPendingRewrap(false);
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      setSuccess('비밀번호가 변경되었습니다.');
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setSubmitting(true);
    setError('');
    const message = await deleteAccount();
    if (message) {
      setError(message);
      setSubmitting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="account">
      <div className="account-header">
        <button type="button" className="account-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2 className="account-title">계정 설정</h2>
      </div>

      <div className="account-card">
        <p className="account-label">이메일</p>
        <p className="account-email">{user?.email}</p>
      </div>

      <form className="auth-form" onSubmit={handlePasswordReset} style={{ marginBottom: 20 }}>
        <p className="account-label">비밀번호 재설정</p>
        <div className="auth-field">
          <label htmlFor="current-password">현재 비밀번호</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="new-password">새 비밀번호</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="confirm-password">비밀번호 확인</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {success && <p className="auth-success">{success}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          비밀번호 변경
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <div className="account-actions">
        <button type="button" className="auth-btn ghost" onClick={signOut}>
          로그아웃
        </button>
        <button
          type="button"
          className={`auth-btn ${confirmingDelete ? 'danger' : 'ghost'}`}
          onClick={handleDelete}
          disabled={submitting}
        >
          {confirmingDelete ? '정말 탈퇴하기' : '회원 탈퇴'}
        </button>
        {confirmingDelete && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setConfirmingDelete(false)}
          >
            취소
          </button>
        )}
      </div>
    </div>
  );
}
