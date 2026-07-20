import { Popover, Portal } from "@ark-ui/react";
import { useState } from "react";

import { Menu, MenuContent, MenuContextTrigger } from "../ui/menu.tsx";
import {
  RowActionsMenuContent,
  type RowActionsMenuContentProps,
} from "./row-actions-menu-content.tsx";
import { RowJsonViewer } from "./row-json-viewer.tsx";

export interface RowContextMenuProps extends RowActionsMenuContentProps {
  children: React.ReactNode;
  onExpandRowJson?: (row: Record<string, unknown>) => void;
  tableMetadata?: { schema?: string; table?: string };
  connectionUrl?: string;
}

export function RowContextMenu(props: RowContextMenuProps) {
  const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);

  return (
    <Popover.Root
      lazyMount
      open={isJsonViewerOpen}
      onOpenChange={(details) => setIsJsonViewerOpen(details.open)}
      positioning={{ placement: "right" }}
    >
      <Menu lazyMount>
        <Popover.Anchor className="contents">
          <MenuContextTrigger asChild>{props.children}</MenuContextTrigger>
        </Popover.Anchor>
        <Portal>
          <MenuContent className="z-100" data-row-context-menu>
            <RowActionsMenuContent
              row={props.row}
              onViewJson={() => setIsJsonViewerOpen(true)}
              onExpandRelationships={props.onExpandRelationships}
              onClose={props.onClose}
              onEdit={props.onEdit}
              onDuplicate={props.onDuplicate}
            />
          </MenuContent>
        </Portal>
      </Menu>
      <Portal>
        <Popover.Positioner>
          <Popover.Content className="z-50">
            <RowJsonViewer
              row={props.row}
              onClose={() => setIsJsonViewerOpen(false)}
              onExpandToDialog={() => props.onExpandRowJson?.(props.row)}
              showRelationships={true}
              schema={props.tableMetadata?.schema}
              table={props.tableMetadata?.table}
              connectionUrl={props.connectionUrl}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
