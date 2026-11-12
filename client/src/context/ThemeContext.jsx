// client/src/context/ThemeContext.jsx
// Light/dark theme state. index.html applies the saved theme before React
// mounts (no flash); this keeps it in sync afterwards. Read it with
// useTheme() from hooks/useTheme.js.
import { useState, useEffect, useMemo } from "react";
import { ThemeContext } from "./themeContextObject";

function getInitialTheme() {
  const saved = localStorage.getItem("shyftra_theme");
  if (saved === "shyftraLight" || saved === "shyftraDark") return saved;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "shyftraDark" : "shyftraLight";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("shyftra_theme", theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "shyftraDark",
      toggleTheme: () => setTheme((t) => (t === "shyftraDark" ? "shyftraLight" : "shyftraDark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
