import {
  ActionBarCloseTrigger,
  ActionBarContent,
  ActionBarPositioner,
  ActionBarRoot,
  ActionBarSelectionTrigger,
} from "#src/components/ui/action-bar.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { useState } from "react";

export function ActionBarExample() {
  return (
    <div>
      <ActionBarRoot>
        <ActionBarSelectionTrigger>Actions</ActionBarSelectionTrigger>
        <ActionBarPositioner>
          <ActionBarContent>
            <Button size="sm" variant="ghost">
              Edit
            </Button>
            <Button size="sm" variant="ghost">
              Duplicate
            </Button>
            <ActionBarCloseTrigger>Close</ActionBarCloseTrigger>
          </ActionBarContent>
        </ActionBarPositioner>
      </ActionBarRoot>
    </div>
  );
}
