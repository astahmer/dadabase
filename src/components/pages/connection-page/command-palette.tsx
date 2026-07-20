import { Command } from "cmdk";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import type { CommandPaletteCommand } from "#src/lib/command-palette-commands.ts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { Kbd } from "#src/components/ui/kbd.tsx";
import { cn } from "#src/lib/utils.ts";

interface ConnectionCommandPaletteProps {
  commands: CommandPaletteCommand[];
  onSelect: (commandId: string) => void;
}

const GROUP_ORDER = ["Actions", "Query", "Navigation", "Tables", "Schemas", "Connections"] as const;

export function ConnectionCommandPalette(props: ConnectionCommandPaletteProps) {
  const { commands, onSelect } = props;
  const [open, setOpen] = useState(false);

  const openPalette = useEffectEvent(() => setOpen(true));
  const closePalette = useEffectEvent(() => setOpen(false));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;

      // Always claim Cmd/Ctrl+K at the app level (including editors).
      event.preventDefault();
      if (open) {
        closePalette();
      } else {
        openPalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandPaletteCommand[]>();
    for (const command of commands) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return GROUP_ORDER.filter((group) => map.has(group)).map((group) => ({
      group,
      items: map.get(group)!,
    }));
  }, [commands]);

  const handleSelect = (commandId: string) => {
    closePalette();
    onSelect(commandId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
      }}
    >
      <DialogContent
        size="lg"
        className="gap-0 overflow-hidden p-0 sm:max-w-xl [&>button]:hidden"
        data-testid="command-palette"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search and run connection page actions</DialogDescription>
        </DialogHeader>

        <Command label="Command palette" className="flex max-h-[min(28rem,70vh)] flex-col" loop>
          <div className="flex items-center gap-2 border-b px-3">
            <Command.Input
              autoFocus
              placeholder="Type a command or search…"
              className="placeholder:text-muted-foreground/70 flex h-11 w-full bg-transparent text-sm outline-none"
            />
            <Kbd size="sm">esc</Kbd>
          </div>

          <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
              No commands found
            </Command.Empty>

            {grouped.map(({ group, items }) => (
              <Command.Group
                key={group}
                heading={group}
                className="text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
              >
                {items.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={`${command.label} ${command.keywords.join(" ")}`}
                    keywords={command.keywords}
                    onSelect={() => handleSelect(command.id)}
                    className={cn(
                      "aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                      "relative flex cursor-default items-center rounded-md px-2 py-2 text-sm outline-none select-none",
                    )}
                  >
                    {command.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
