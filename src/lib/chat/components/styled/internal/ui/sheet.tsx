// Vendored shim: re-exports dadabase's ark-ui Sheet with the same export surface
// the vendored thread components expect (Sheet, SheetContent w/ side, SheetHeader,
// SheetTitle, SheetDescription) — instead of porting the radix-ui original.
// Sheet adapts ark's OpenChangeDetails back to the boolean callback the vendored
// code passes (e.g. setSheetOpen).
import type { ComponentProps } from "react";

import {
  Sheet as ArkSheet,
  SheetContent as ArkSheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#src/components/ui/sheet.tsx";

type ArkSheetProps = ComponentProps<typeof ArkSheet>;

export const Sheet = ({ onOpenChange, ...props }: Omit<ArkSheetProps, "onOpenChange"> & {
  onOpenChange?: (open: boolean) => void;
}) => (
  <ArkSheet
    {...props}
    onOpenChange={(details) => onOpenChange?.(details.open)}
  />
);

export {
  ArkSheetContent as SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
};
