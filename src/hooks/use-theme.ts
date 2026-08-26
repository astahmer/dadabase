import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export const useTheme = () => {
  // The blocking bootstrap in __root.tsx already applied the persisted/system
  // theme to <html> before first paint — read it back instead of assuming
  // "light" (which caused a dark→light mismatch until the effect ran).
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined" || !document.documentElement.classList.contains("dark")
      ? "light"
      : "dark",
  );
  const [mounted, setMounted] = useState(false);

  const applyTheme = (newTheme: Theme) => {
    const html = document.documentElement;
    if (newTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("theme", newTheme);
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return { theme, toggleTheme, mounted };
};
