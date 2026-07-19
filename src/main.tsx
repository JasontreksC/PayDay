import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { CryptoProvider } from './contexts/CryptoContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CryptoProvider>
        <App />
      </CryptoProvider>
    </AuthProvider>
  </StrictMode>,
);
