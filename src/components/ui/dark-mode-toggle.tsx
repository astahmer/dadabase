import { Moon, Sun } from "lucide-react";
import { useTheme } from "#src/hooks/use-theme";
import { Button } from "./button";

export const DarkModeToggle = () => {
	const { theme, toggleTheme, mounted } = useTheme();

	if (!mounted) {
		return null;
	}

	return (
		<Button onClick={toggleTheme} variant="outline" size="icon">
			{theme === "light" ? (
				<Moon className="h-4 w-4" />
			) : (
				<Sun className="h-4 w-4" />
			)}
		</Button>
	);
};
