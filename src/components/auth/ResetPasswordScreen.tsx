import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import './auth.css';

type Step = 'password' | 'recovery';

export function ResetPasswordScreen() {
  const { updatePassword, finishRecovery } = useAuth();
  const { restoreVaultFromRecoveryKey, resetVaultWithPassword } = useCrypto();

  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    const authError = await updatePassword(password);
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    setStep('recovery');
    setSubmitting(false);
  };

  const handleRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const cryptoError = await restoreVaultFromRecoveryKey(recoveryKey, password);
    if (cryptoError) {
      setError(cryptoError);
      setSubmitting(false);
      return;
    }

    finishRecovery();
    setSubmitting(false);
  };

  const handleSkipRecovery = async () => {
    setError('');
    setSubmitting(true);

    const cryptoError = await resetVaultWithPassword(password);
    if (cryptoError) {
      setError(cryptoError);
      setSubmitting(false);
      return;
    }

    finishRecovery();
    setSubmitting(false);
  };

  if (step === 'recovery') {
    return (
      <div className="auth">
        <div className="auth-brand">
          <h1>PayDay</h1>
          <p>복구 키로 메모 복원</p>
        </div>
        <p className="auth-muted">
          비밀번호 재설정 후에는 이전 비밀번호로 암호 키를 열 수 없습니다.
          가입 시 저장한 복구 키를 입력하면 암호화된 메모를 그대로 쓸 수 있습니다.
        </p>
        <p className="auth-muted" style={{ marginTop: 10 }}>
          한 번만 입력하면 됩니다. 이후 로그인은 새 비밀번호만으로 가능합니다.
        </p>
        <form className="auth-form" onSubmit={handleRecoverySubmit} style={{ marginTop: 16 }}>
          <div className="auth-field">
            <label htmlFor="recovery-key">복구 키</label>
            <input
              id="recovery-key"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-..."
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={submitting}>
            메모 복구하고 계속
          </button>
          <button
            type="button"
            className="auth-btn ghost"
            onClick={handleSkipRecovery}
            disabled={submitting}
          >
            복구 키 없이 새로 시작
          </button>
        </form>
        <p className="auth-muted" style={{ marginTop: 12 }}>
          복구 키 없이 시작하면 이전 메모는 복호화할 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-brand">
        <h1>PayDay</h1>
        <p>새 비밀번호 설정</p>
      </div>
      <p className="auth-muted">
        다음 단계에서 복구 키를 입력해 암호화된 이전 메모를 복구합니다.
      </p>
      <form className="auth-form" onSubmit={handlePasswordSubmit}>
        <div className="auth-field">
          <label htmlFor="password">새 비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
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
            minLength={8}
            required
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          다음
        </button>
      </form>
    </div>
  );
}
