import { useEffect, useState } from 'react';
import { AuthScreen } from './components/auth/AuthScreen';
import { RecoveryKeyRevealScreen } from './components/auth/RecoveryKeyRevealScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { UnlockScreen } from './components/auth/UnlockScreen';
import { useAuth } from './contexts/AuthContext';
import { useCrypto } from './contexts/CryptoContext';
import { isSupabaseConfigured } from './lib/supabase';
import { LandingPage } from './pages/LandingPage';
import { LedgerApp } from './pages/LedgerApp';
import './components/auth/auth.css';

function ConfigError() {
  return (
    <div className="auth">
      <div className="auth-brand">
        <h1>PayDay</h1>
      </div>
      <p className="auth-message">Supabase 환경 변수가 설정되지 않았습니다.</p>
      <p className="auth-muted">
        .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 추가한 뒤 서버를 재시작하세요.
      </p>
    </div>
  );
}

function App() {
  const { user, loading, isRecovery } = useAuth();
  const { status, pendingRecoveryKey, acknowledgeRecoveryKey } = useCrypto();
  const [guestAuth, setGuestAuth] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (!user) {
      setGuestAuth(false);
      setShowLanding(false);
    }
  }, [user]);

  if (!isSupabaseConfigured) {
    return <ConfigError />;
  }

  if (loading || (user && status === 'loading')) {
    return <div className="auth-loading">로딩 중...</div>;
  }

  if (isRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!user) {
    if (guestAuth) {
      return (
        <AuthScreen
          initialView="signup"
          onBack={() => setGuestAuth(false)}
        />
      );
    }

    return (
      <LandingPage
        mode="guest"
        onPrimary={() => setGuestAuth(true)}
      />
    );
  }

  // 로그인 폼에서 이미 비밀번호로 키를 열었으면 ready.
  // locked는 세션만 있고 탭에 DEK가 없을 때(새 탭 등)만 재입력.
  if (status === 'locked') {
    return <UnlockScreen />;
  }

  if (status !== 'ready') {
    return <div className="auth-loading">로딩 중...</div>;
  }

  if (pendingRecoveryKey) {
    return (
      <RecoveryKeyRevealScreen
        recoveryKey={pendingRecoveryKey}
        email={user.email}
        onContinue={acknowledgeRecoveryKey}
      />
    );
  }

  if (showLanding) {
    return (
      <LandingPage
        mode="member"
        onPrimary={() => setShowLanding(false)}
      />
    );
  }

  return <LedgerApp onShowLanding={() => setShowLanding(true)} />;
}

export default App;
