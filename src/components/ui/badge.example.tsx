import { Badge, badgeVariants } from "#src/components/ui/badge.tsx";

import { Stack } from "./layout.tsx";

export function BadgeExample() {
  const sizes = ["2xs", "xs", "sm", "md", "lg"] as const;
  const variants = ["subtle", "solid", "outline"] as const;

  return (
    <Stack>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Variants</h4>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <Badge key={variant} variant={variant} colorPalette="default">
              {variant}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Color Palettes</h4>
        <div className="flex flex-wrap gap-2">
          <Badge colorPalette="default">default</Badge>
          <Badge colorPalette="secondary">secondary</Badge>
          <Badge colorPalette="destructive">destructive</Badge>
          <Badge colorPalette="success">success</Badge>
          <Badge colorPalette="error">error</Badge>
          <Badge colorPalette="warning">warning</Badge>
          <Badge colorPalette="info">info</Badge>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Sizes</h4>
        <div className="flex flex-wrap items-center gap-2">
          {sizes.map((size) => (
            <Badge key={size} size={size} colorPalette="default">
              {size}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Data Types</h4>
        <div className="flex flex-wrap gap-2">
          <Badge dataType="id">id</Badge>
          <Badge dataType="timestamp">timestamp</Badge>
          <Badge dataType="numeric">numeric</Badge>
          <Badge dataType="text">text</Badge>
          <Badge dataType="boolean">boolean</Badge>
          <Badge dataType="json">json</Badge>
        </div>
      </div>
    </Stack>
  );
}
