import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    return savedTheme || "system";
  });

  const getSystemTheme = (): ResolvedTheme => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = theme === "system" ? getSystemTheme() : theme;
    
    if (currentTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    setResolvedTheme(currentTheme);
    if (theme !== "system") {
      localStorage.setItem("theme", theme);
    } else {
      localStorage.removeItem("theme");
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const newTheme = getSystemTheme();
        setResolvedTheme(newTheme);
        const root = document.documentElement;
        if (newTheme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    if (theme === "system") {
      setThemeState(getSystemTheme());
    } else {
      setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

