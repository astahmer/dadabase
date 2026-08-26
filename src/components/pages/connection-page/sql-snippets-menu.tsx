import { Portal } from "@ark-ui/react";
import { BookMarked } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuTrigger,
} from "#src/components/ui/menu.tsx";
import {
  ensureSqlSnippetsSeeded,
  type SqlSnippet,
  SNIPPET_TABLE_TOKEN,
} from "#src/lib/sql-snippets.ts";

interface SqlSnippetsMenuProps {
  onInsertSnippet: (sql: string) => void;
  /** Schema-aware insertion (audit S3): tables offered for the {{table}} token. */
  tables?: Array<string>;
  /** Preselected table (e.g. the table open in the workspace). */
  activeTable?: string;
}

/**
 * Menu to insert a saved SQL snippet into the editor.
 */
export function SqlSnippetsMenu({ onInsertSnippet, tables, activeTable }: SqlSnippetsMenuProps) {
  const [snippets, setSnippets] = useState<SqlSnippet[]>([]);

  const needsTable = useMemo(
    () => snippets.some((snippet) => snippet.sql.includes(SNIPPET_TABLE_TOKEN)),
    [snippets],
  );
  const tableChoices = useMemo(() => tables ?? [], [tables]);
  const [chosenTable, setChosenTable] = useState("");

  useEffect(() => {
    setSnippets(ensureSqlSnippetsSeeded());
  }, []);

  // Keep the chosen table sensible as context changes (active table first).
  const effectiveTable = chosenTable || activeTable || tableChoices[0] || "";

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
          {needsTable && tableChoices.length > 0 ? (
            <div className="border-b px-2 pb-2 pt-1">
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Insert table as
              </label>
              <select
                value={effectiveTable}
                onChange={(event) => setChosenTable(event.target.value)}
                aria-label="Table to insert into snippet"
                data-testid="sql-snippet-table-select"
                className="bg-background border-border h-7 w-full rounded border px-1.5 text-xs"
              >
                {!tableChoices.includes(effectiveTable) && effectiveTable ? (
                  <option value={effectiveTable}>{effectiveTable}</option>
                ) : null}
                {tableChoices.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {snippets.length === 0 ? (
            <MenuItem value="empty" disabled>
              <MenuItemText>No snippets</MenuItemText>
            </MenuItem>
          ) : (
            snippets.map((snippet) => (
              <MenuItem
                key={snippet.id}
                value={snippet.id}
                onClick={() => onInsertSnippet(resolveForInsert(snippet.sql, effectiveTable))}
              >
                <MenuItemText>
                  <span className="flex flex-col gap-0.5">
                    <span>{snippet.name}</span>
                    <span className="text-muted-foreground max-w-64 truncate font-mono text-xs font-normal">
                      {resolveForInsert(snippet.sql, effectiveTable)}
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

const resolveForInsert = (sql: string, table: string): string =>
  sql.includes(SNIPPET_TABLE_TOKEN) ? sql.replaceAll(SNIPPET_TABLE_TOKEN, table || "your_table") : sql;
