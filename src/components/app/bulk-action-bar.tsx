import { Copy, CopyPlus, FileJson, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";

import * as ActionBar from "../ui/action-bar";
import { Button } from "../ui/button";
import { HStack } from "../ui/layout";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTrigger } from "../ui/menu";

interface BulkActionBarProps {
  selectedCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onExportJson?: () => void;
  onExportCsv?: () => void;
  onCopyJson?: () => void;
  onCopyCsv?: () => void;
  onCopyInsert?: () => void;
  onViewJson?: () => void;
  onLogRows?: () => void;
  onExpandRelationships?: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onEdit,
  onDelete,
  onDuplicate,
  onExportJson,
  onExportCsv,
  onCopyJson,
  onCopyCsv,
  onCopyInsert,
  onViewJson,
  onLogRows,
  onExpandRelationships,
  isLoading = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <ActionBar.ActionBarRoot open={selectedCount > 0}>
      <ActionBar.ActionBarPositioner>
        <ActionBar.ActionBarContent className="dark">
          <ActionBar.ActionBarSelectionTrigger disabled>
            {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
          </ActionBar.ActionBarSelectionTrigger>

          <ActionBar.ActionBarSeparator />

          <HStack>
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="border-background/20"
                >
                  <Copy className="mr-1 h-4 w-4" />
                  Copy
                </Button>
              </MenuTrigger>
              <MenuContent>
                {onCopyJson && (
                  <MenuItem value="copy-json" onClick={onCopyJson}>
                    <MenuItemText>Copy as JSON</MenuItemText>
                  </MenuItem>
                )}
                {onCopyCsv && (
                  <MenuItem value="copy-csv" onClick={onCopyCsv}>
                    <MenuItemText>Copy as CSV</MenuItemText>
                  </MenuItem>
                )}
                {onCopyInsert && (
                  <MenuItem value="copy-insert" onClick={onCopyInsert}>
                    <MenuItemText>Copy as INSERT</MenuItemText>
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>

            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="border-background/20"
                >
                  <FileJson className="mr-1 h-4 w-4" />
                  Export
                </Button>
              </MenuTrigger>
              <MenuContent>
                {onExportJson && (
                  <MenuItem value="export-json" onClick={onExportJson}>
                    <MenuItemText>Export as JSON</MenuItemText>
                  </MenuItem>
                )}
                {onExportCsv && (
                  <MenuItem value="export-csv" onClick={onExportCsv}>
                    <MenuItemText>Export as CSV</MenuItemText>
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>

            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="border-background/20"
                >
                  <MoreHorizontal className="mr-1 h-4 w-4" />
                  More
                </Button>
              </MenuTrigger>
              <MenuContent>
                {onViewJson && (
                  <MenuItem value="view-json" onClick={onViewJson}>
                    <MenuItemText>View JSON</MenuItemText>
                  </MenuItem>
                )}
                {onLogRows && (
                  <MenuItem value="log-rows" onClick={onLogRows}>
                    <MenuItemText>Log rows to console</MenuItemText>
                  </MenuItem>
                )}
                {onExpandRelationships && (
                  <MenuItem value="expand-relationships" onClick={onExpandRelationships}>
                    <MenuItemText>Expand relationships</MenuItemText>
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </HStack>

          <ActionBar.ActionBarSeparator />

          <HStack>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={isLoading}
                className="border-background/20"
                data-testid="bulk-edit-button"
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                disabled={isLoading}
                className="border-background/20"
                data-testid="bulk-duplicate-button"
              >
                <CopyPlus className="mr-1 h-4 w-4" />
                Duplicate
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={isLoading}>
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            )}
          </HStack>

          <ActionBar.ActionBarSeparator />

          <ActionBar.ActionBarCloseTrigger asChild>
            <Button variant="ghost" size="sm" className="hover:bg-background/20 h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </ActionBar.ActionBarCloseTrigger>
        </ActionBar.ActionBarContent>
      </ActionBar.ActionBarPositioner>
    </ActionBar.ActionBarRoot>
  );
}
