import { useEffect } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        themeParams?: Record<string, string | undefined>;
      };
    };
  }
}

export function useTelegram() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    webApp.ready?.();
    webApp.expand?.();

    const root = document.documentElement;
    const theme = webApp.themeParams ?? {};

    if (theme.bg_color) root.style.setProperty('--tg-bg', theme.bg_color);
    if (theme.text_color) root.style.setProperty('--tg-text', theme.text_color);
    if (theme.hint_color) root.style.setProperty('--tg-hint', theme.hint_color);
    if (theme.button_color) root.style.setProperty('--tg-button', theme.button_color);
    if (theme.button_text_color) root.style.setProperty('--tg-button-text', theme.button_text_color);
    if (theme.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', theme.secondary_bg_color);
  }, []);
}
