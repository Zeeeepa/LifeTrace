import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lifetrace-theme', theme);
    }
  },
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lifetrace-theme', newTheme);
      }
      return { theme: newTheme };
    });
  },
}));

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add(systemTheme);
  } else {
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }
}

// 初始化主题
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('lifetrace-theme') as Theme | null;
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    applyTheme(stored);
    useThemeStore.setState({ theme: stored });
  } else {
    applyTheme('system');
  }

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentTheme = useThemeStore.getState().theme;
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}
