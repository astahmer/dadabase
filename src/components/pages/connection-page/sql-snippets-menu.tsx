import { Portal } from "@ark-ui/react";
import { BookMarked } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { ensureSqlSnippetsSeeded, type SqlSnippet } from "#src/lib/sql-snippets.ts";

interface SqlSnippetsMenuProps {
  onInsertSnippet: (sql: string) => void;
}

/**
 * Menu to insert a saved SQL snippet into the editor.
 */
export function SqlSnippetsMenu({ onInsertSnippet }: SqlSnippetsMenuProps) {
  const [snippets, setSnippets] = useState<SqlSnippet[]>([]);

  useEffect(() => {
    setSnippets(ensureSqlSnippetsSeeded());
  }, []);

  return (
    <Menu
      onOpenChange={(details) => {
        if (details.open) setSnippets(ensureSqlSnippetsSeeded());
      }}
    >
      {/* Tooltip must not wrap MenuTrigger — nested asChild breaks menu positioning (top-left). */}
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          data-testid="sql-snippets-menu"
          aria-label="SQL snippets"
          title="SQL snippets"
        >
          <BookMarked className="h-4 w-4" />
        </Button>
      </MenuTrigger>
      <Portal>
        <MenuContent className="min-w-56" data-testid="sql-snippets-menu-content">
          {snippets.length === 0 ? (
            <MenuItem value="empty" disabled>
              <MenuItemText>No snippets</MenuItemText>
            </MenuItem>
          ) : (
            snippets.map((snippet) => (
              <MenuItem
                key={snippet.id}
                value={snippet.id}
                onClick={() => onInsertSnippet(snippet.sql)}
              >
                <MenuItemText>
                  <span className="flex flex-col gap-0.5">
                    <span>{snippet.name}</span>
                    <span className="text-muted-foreground max-w-64 truncate font-mono text-xs font-normal">
                      {snippet.sql}
                    </span>
                  </span>
                </MenuItemText>
              </MenuItem>
            ))
          )}
        </MenuContent>
      </Portal>
    </Menu>
  );
}
