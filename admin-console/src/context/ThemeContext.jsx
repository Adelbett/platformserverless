import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Apply class synchronously so first paint has correct theme
const getInitialDark = () => {
    try {
        const stored = localStorage.getItem('nextstep-theme');
        if (stored) return stored === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
        return true;
    }
};

const applyTheme = (dark) => {
    if (dark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('nextstep-theme', dark ? 'dark' : 'light'); } catch {}
};

// Apply immediately (before component mount)
applyTheme(getInitialDark());

export const ThemeProvider = ({ children }) => {
    const [dark, setDark] = useState(getInitialDark);

    const toggleTheme = () => {
        setDark(d => {
            const next = !d;
            applyTheme(next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ dark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
