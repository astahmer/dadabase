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
}

export function RowActionsMenu({ row, onViewJson, onExpandRelationships }: RowActionsMenuProps) {
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
      <Button ref={buttonRef} variant="ghost" size="xs" onClick={() => setOpen((c) => !c)}>
        <LucideMoreHorizontal />
      </Button>
      <Portal>
        <MenuContent className="z-50">
          <RowActionsMenuContent
            row={row}
            onClose={() => setOpen(false)}
            onViewJson={onViewJson}
            onExpandRelationships={onExpandRelationships}
          />
        </MenuContent>
      </Portal>
    </Menu>
  );
}
