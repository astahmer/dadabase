import type { ComponentProps } from "react";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "#src/hooks/use-theme";

import { Button } from "./button";

export const DarkModeToggle = (props: ComponentProps<typeof Button>) => {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return null;
  }

  return (
    <Button variant="outline" size="icon" {...props} onClick={toggleTheme}>
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
};
