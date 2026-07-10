import { AuthScreen } from './components/auth/AuthScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
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

  if (!isSupabaseConfigured) {
    return <ConfigError />;
  }

  if (loading) {
    return <div className="auth-loading">로딩 중...</div>;
  }

  if (isRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <LedgerApp />;
}

export default App;
