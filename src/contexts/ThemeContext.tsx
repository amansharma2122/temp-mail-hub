import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, STORAGE_KEYS } from '@/lib/storage';

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  card: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isDark: boolean;
}

const defaultThemes: Theme[] = [
  {
    id: 'cyber-dark',
    name: 'Cyber Dark',
    colors: {
      primary: '175 80% 50%',
      accent: '280 70% 55%',
      background: '222 47% 5%',
      card: '222 47% 8%',
    },
    isDark: true,
  },
  {
    id: 'ocean-dark',
    name: 'Ocean Dark',
    colors: {
      primary: '200 80% 50%',
      accent: '230 70% 55%',
      background: '220 47% 5%',
      card: '220 47% 8%',
    },
    isDark: true,
  },
  {
    id: 'emerald-dark',
    name: 'Emerald Dark',
    colors: {
      primary: '150 80% 45%',
      accent: '170 70% 55%',
      background: '160 40% 5%',
      card: '160 40% 8%',
    },
    isDark: true,
  },
  {
    id: 'sunset-dark',
    name: 'Sunset Dark',
    colors: {
      primary: '25 90% 55%',
      accent: '350 80% 55%',
      background: '20 30% 5%',
      card: '20 30% 8%',
    },
    isDark: true,
  },
  {
    id: 'light-minimal',
    name: 'Light Minimal',
    colors: {
      primary: '220 70% 50%',
      accent: '280 70% 55%',
      background: '0 0% 100%',
      card: '0 0% 98%',
    },
    isDark: false,
  },
];

interface ThemeContextType {
  theme: Theme;
  themes: Theme[];
  setTheme: (themeId: string) => void;
  addCustomTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themes, setThemes] = useState<Theme[]>(defaultThemes);
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return storage.get(STORAGE_KEYS.THEME, 'cyber-dark');
  });

  const theme = themes.find(t => t.id === currentThemeId) || themes[0];

  useEffect(() => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--card', theme.colors.card);
    
    // Set dark/light mode
    if (theme.isDark) {
      root.classList.add('dark');
      root.style.setProperty('--foreground', '210 40% 98%');
      root.style.setProperty('--muted-foreground', '215 20% 55%');
      root.style.setProperty('--border', '222 30% 18%');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--foreground', '222 47% 11%');
      root.style.setProperty('--muted-foreground', '215 16% 47%');
      root.style.setProperty('--border', '214 32% 91%');
    }
  }, [theme]);

  const setTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    storage.set(STORAGE_KEYS.THEME, themeId);
  };

  const addCustomTheme = (newTheme: Theme) => {
    setThemes([...themes, newTheme]);
  };

  return (
    <ThemeContext.Provider value={{ theme, themes, setTheme, addCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
