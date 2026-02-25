import { Spinner } from "#src/components/ui/spinner.tsx";

import { Stack } from "./layout.tsx";

export function SpinnerExample() {
  return (
    <Stack>
      <div>
        <h4 className="mb-3 text-sm font-semibold">Sizes</h4>
        <div className="flex gap-6">
          <Spinner size="sm" label="Small" />
          <Spinner size="md" label="Medium" />
          <Spinner size="lg" label="Large" />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Color Palettes</h4>
        <div className="flex gap-6">
          <Spinner colorPalette="primary" label="Primary" />
          <Spinner colorPalette="secondary" label="Secondary" />
          <Spinner colorPalette="destructive" label="Destructive" />
        </div>
      </div>
    </Stack>
  );
}
