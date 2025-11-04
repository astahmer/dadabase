import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export const useTheme = () => {
	const [theme, setTheme] = useState<Theme>("light");
	const [mounted, setMounted] = useState(false);

	// Load theme from localStorage on mount
	useEffect(() => {
		setMounted(true);
		const storedTheme = localStorage.getItem("theme") as Theme | null;
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;

		const initialTheme = storedTheme || (prefersDark ? "dark" : "light");
		setTheme(initialTheme);
		applyTheme(initialTheme);
	}, []);

	const applyTheme = (newTheme: Theme) => {
		const html = document.documentElement;
		if (newTheme === "dark") {
			html.classList.add("dark");
		} else {
			html.classList.remove("dark");
		}
		localStorage.setItem("theme", newTheme);
	};

	const toggleTheme = () => {
		const newTheme = theme === "light" ? "dark" : "light";
		setTheme(newTheme);
		applyTheme(newTheme);
	};

	return { theme, toggleTheme, mounted };
};
