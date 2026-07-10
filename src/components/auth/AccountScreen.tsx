import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './auth.css';

interface AccountScreenProps {
  onBack: () => void;
}

export function AccountScreen({ onBack }: AccountScreenProps) {
  const { user, signOut, deleteAccount } = useAuth();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setSubmitting(true);
    setError('');

    const message = await deleteAccount();
    if (message) {
      setError(message);
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="account">
      <div className="account-header">
        <button type="button" className="account-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2 className="account-title">계정</h2>
      </div>

      <div className="account-card">
        <p className="account-label">이메일</p>
        <p className="account-email">{user?.email}</p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="account-actions">
        <button type="button" className="auth-btn ghost" onClick={signOut}>
          로그아웃
        </button>
        <button
          type="button"
          className={`auth-btn ${confirming ? 'danger' : 'ghost'}`}
          onClick={handleDelete}
          disabled={submitting}
        >
          {confirming ? '정말 탈퇴하기' : '회원 탈퇴'}
        </button>
        {confirming && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setConfirming(false)}
          >
            취소
          </button>
        )}
      </div>
    </div>
  );
}
