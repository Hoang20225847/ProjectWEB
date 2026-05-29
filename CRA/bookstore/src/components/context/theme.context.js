import { createContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'ui_theme_mode';
const THEME_OPTIONS = ['light', 'dark'];

export const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  cycleTheme: () => {},
  options: THEME_OPTIONS,
});

function getInitialTheme() {
  const fromStorage = localStorage.getItem(THEME_STORAGE_KEY);
  if (THEME_OPTIONS.includes(fromStorage)) return fromStorage;
  return 'dark';
}

export function ThemeWrapper({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (!THEME_OPTIONS.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const cycleTheme = () => {
    const idx = THEME_OPTIONS.indexOf(theme);
    const nextIdx = idx >= 0 ? (idx + 1) % THEME_OPTIONS.length : 0;
    setTheme(THEME_OPTIONS[nextIdx]);
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      cycleTheme,
      options: THEME_OPTIONS,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

