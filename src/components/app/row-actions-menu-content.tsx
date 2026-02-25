import { Clipboard, useClipboard } from "@ark-ui/react";
import { Code, Copy, Eye, Link } from "lucide-react";

import { MenuItem, MenuItemText } from "../ui/menu";

export interface RowActionsMenuContentProps {
  row: Record<string, unknown>;
  onViewJson?: () => void;
  onClose?: () => void;
  onExpandRelationships?: () => void;
}

export function RowActionsMenuContent({
  row,
  onViewJson,
  onClose,
  onExpandRelationships,
}: RowActionsMenuContentProps) {
  const handleLogRow = () => {
    console.log("Row data:", row);
    onClose?.();
  };

  const clipboard = useClipboard();

  return (
    <>
      {onViewJson && (
        <MenuItem value="view-json" onClick={onViewJson}>
          <Code className="size-4" />
          <MenuItemText>View JSON</MenuItemText>
        </MenuItem>
      )}
      <MenuItem value="log" onClick={handleLogRow}>
        <Eye className="size-4" />
        <MenuItemText>Log row to console</MenuItemText>
      </MenuItem>
      <Clipboard.RootProvider value={clipboard}>
        <MenuItem value="copy" asChild>
          <Clipboard.Trigger
            onMouseEnter={() => {
              clipboard.setValue(JSON.stringify(row, null, 2));
            }}
            onClick={() => {
              clipboard.copy();
              onClose?.();
            }}
          >
            <Copy className="size-4" />
            <MenuItemText>Copy row as JSON</MenuItemText>
          </Clipboard.Trigger>
        </MenuItem>
        {onExpandRelationships && (
          <MenuItem value="expand-relationships" onClick={onExpandRelationships}>
            <Link className="size-4" />
            <MenuItemText>Expand relationships</MenuItemText>
          </MenuItem>
        )}
      </Clipboard.RootProvider>
    </>
  );
}
