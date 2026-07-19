import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import './auth.css';

function AuthShell({
  children,
  title,
  subtitle,
  onBack,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div className="auth">
      {onBack && (
        <button type="button" className="auth-back" onClick={onBack}>
          ← 소개로
        </button>
      )}
      <div className="auth-brand">
        <h1>PayDay</h1>
        <p>{subtitle ?? '나의 가계부'}</p>
      </div>
      {title && <p className="auth-message">{title}</p>}
      {children}
    </div>
  );
}

interface AuthScreenProps {
  initialView?: 'login' | 'signup';
  onBack?: () => void;
}

export function AuthScreen({ initialView = 'login', onBack }: AuthScreenProps) {
  const {
    authView,
    pendingEmail,
    pendingEmailPurpose,
    setAuthView,
    signIn,
    signUp,
    resetPassword,
    resendConfirmation,
    verifyEmailOtp,
  } = useAuth();
  const { beginClientUnlock, cancelClientUnlock, unlockWithPassword } = useCrypto();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAuthView(initialView);
  }, [initialView, setAuthView]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    beginClientUnlock();

    const authError = await signIn(email, password);
    if (authError) {
      cancelClientUnlock();
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    const cryptoError = await unlockWithPassword(password);
    if (cryptoError) setError(cryptoError);

    setSubmitting(false);
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    beginClientUnlock();

    const authError = await signUp(email, password);
    if (authError) {
      cancelClientUnlock();
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    const cryptoError = await unlockWithPassword(password);
    if (cryptoError && cryptoError !== '로그인이 필요합니다.') {
      setError(cryptoError);
    }

    setSubmitting(false);
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);

    const authError = await verifyEmailOtp(code);
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    // 인증 성공 → 세션 생성됨. 방금 가입에 쓴 비밀번호로 메모 vault를 만든다.
    // (비밀번호를 알 수 없는 경우엔 이후 잠금 해제 화면에서 다시 입력)
    beginClientUnlock();
    if (password) {
      const cryptoError = await unlockWithPassword(password);
      if (cryptoError && cryptoError !== '로그인이 필요합니다.') {
        setError(cryptoError);
      }
    } else {
      cancelClientUnlock();
    }

    setSubmitting(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);

    const authError = await resetPassword(email);
    if (authError) setError(authError.message);

    setSubmitting(false);
  };

  const handleResend = async () => {
    resetMessages();
    setSubmitting(true);

    const authError = await resendConfirmation();
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(
        pendingEmailPurpose === 'reset'
          ? '재설정 메일을 다시 보냈습니다.'
          : '인증 메일을 다시 보냈습니다.',
      );
    }

    setSubmitting(false);
  };

  if (authView === 'check-email') {
    const isReset = pendingEmailPurpose === 'reset';
    return (
      <AuthShell title="이메일을 확인해 주세요" onBack={onBack}>
        <p className="auth-muted">{pendingEmail}</p>
        <p className="auth-message" style={{ marginTop: 16 }}>
          {isReset
            ? '메일의 링크를 눌러 새 비밀번호를 설정하세요.'
            : '메일로 받은 8자리 인증번호를 입력해 주세요.'}
        </p>
        {!isReset && (
          <form className="auth-form" onSubmit={handleVerify} style={{ marginTop: 16 }}>
            <div className="auth-field">
              <label htmlFor="otp">인증번호</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="00000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}
            <button
              className="auth-btn"
              type="submit"
              disabled={submitting || code.length < 8}
            >
              인증하고 계속
            </button>
          </form>
        )}
        {isReset && (
          <>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}
          </>
        )}
        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            onClick={handleResend}
            disabled={submitting}
          >
            {isReset ? '재설정 메일 다시 보내기' : '인증번호 다시 보내기'}
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              resetMessages();
              setAuthView('login');
            }}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </AuthShell>
    );
  }

  if (authView === 'forgot') {
    return (
      <AuthShell title="비밀번호 재설정" onBack={onBack}>
        <p className="auth-muted" style={{ marginBottom: 16 }}>
          가입한 이메일로 재설정 링크를 보냅니다.
        </p>
        <form className="auth-form" onSubmit={handleForgot}>
          <div className="auth-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={submitting}>
            재설정 메일 보내기
          </button>
        </form>
        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              resetMessages();
              setAuthView('login');
            }}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </AuthShell>
    );
  }

  if (authView === 'signup') {
    return (
      <AuthShell onBack={onBack}>
        <form className="auth-form" onSubmit={handleSignUp}>
          <div className="auth-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">비밀번호</label>
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
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={submitting}>
            회원가입
          </button>
        </form>
        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              resetMessages();
              setAuthView('login');
            }}
          >
            이미 계정이 있나요?
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={onBack}>
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
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
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          로그인
        </button>
      </form>
      <div className="auth-links">
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            resetMessages();
            setAuthView('forgot');
          }}
        >
          비밀번호 재설정
        </button>
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            resetMessages();
            setAuthView('signup');
          }}
        >
          회원가입
        </button>
      </div>
    </AuthShell>
  );
}
