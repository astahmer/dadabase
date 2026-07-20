import { Portal } from "@ark-ui/react";
import { LucideMoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "../ui/button";
import { Menu, MenuContent } from "../ui/menu";
import { RowActionsMenuContent } from "./row-actions-menu-content";

export interface RowActionsMenuProps {
  row: Record<string, unknown>;
  onViewJson?: () => void;
  onExpandRelationships?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

export function RowActionsMenu({
  row,
  onViewJson,
  onExpandRelationships,
  onEdit,
  onDuplicate,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu
      open={open}
      onOpenChange={(details) => {
        return setOpen(details.open);
      }}
      lazyMount
      // https://github.com/chakra-ui/chakra-ui/issues/9171#issuecomment-2479477547
      positioning={{
        getAnchorRect: () => buttonRef.current!.getBoundingClientRect(),
      }}
      onInteractOutside={(e) => {
        const target = e.detail.originalEvent.target as HTMLElement | null;
        if (buttonRef.current!.contains(target)) {
          e.preventDefault();
        }
      }}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        size="xs"
        className="h-6 w-6 p-0"
        aria-label="Row actions"
        data-testid="row-actions-menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((c) => !c);
        }}
      >
        <LucideMoreHorizontal className="h-3.5 w-3.5" />
      </Button>
      <Portal>
        <MenuContent className="z-100">
          <RowActionsMenuContent
            row={row}
            onClose={() => setOpen(false)}
            onViewJson={onViewJson}
            onExpandRelationships={onExpandRelationships}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
          />
        </MenuContent>
      </Portal>
    </Menu>
  );
}
