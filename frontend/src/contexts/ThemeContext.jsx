import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const TOKENS = {
  light: {
    '--page-bg': '#f0f2f5',
    '--surface': '#ffffff',
    '--text-primary': '#1a1a2e',
    '--text-secondary': '#333333',
    '--text-muted': '#555555',
    '--text-faint': '#888888',
    '--text-faint2': '#666666',
    '--border': '#e5e7eb',
    '--border-input': '#cccccc',
    '--border-input2': '#d1d5db',
    '--pill-bg': '#ffffff',
    '--pill-text': '#374151',
    '--pill-border': '#d1d5db',
    '--progress-track': '#e5e7eb',
    '--balance-bg': '#f0f9ff',
    '--balance-border': '#bae6fd',
    '--cost-box-bg': '#f0f9ff',
    '--cost-box-border': '#bae6fd',
    '--tag-bg': '#e0e7ff',
    '--tag-text': '#3730a3',
    '--link': '#4f46e5',
  },
  dark: {
    '--page-bg': '#0f172a',
    '--surface': '#1e293b',
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--text-faint': '#64748b',
    '--text-faint2': '#64748b',
    '--border': '#334155',
    '--border-input': '#475569',
    '--border-input2': '#475569',
    '--pill-bg': '#1e293b',
    '--pill-text': '#e2e8f0',
    '--pill-border': '#475569',
    '--progress-track': '#334155',
    '--balance-bg': '#172554',
    '--balance-border': '#1d4ed8',
    '--cost-box-bg': '#1e2a1b',
    '--cost-box-border': '#166534',
    '--tag-bg': '#1e1b4b',
    '--tag-text': '#a5b4fc',
    '--link': '#818cf8',
  },
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
  });
  const [sysDark, setSysDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSysDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const dark = mode === 'dark' || (mode === 'auto' && sysDark);

  useEffect(() => {
    const vars = dark ? TOKENS.dark : TOKENS.light;
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
    document.body.style.background = vars['--page-bg'];
    localStorage.setItem('theme', mode);
  }, [dark, mode]);

  function toggleTheme() {
    setMode(m => m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto');
  }

  return (
    <ThemeContext.Provider value={{ dark, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
