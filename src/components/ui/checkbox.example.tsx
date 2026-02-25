import { Checkbox, CheckboxControl, CheckboxLabel } from "#src/components/ui/checkbox.tsx";
import { useState } from "react";

import { Stack } from "./layout.tsx";

export function CheckboxExample() {
  const [checked, setChecked] = useState<Record<string, boolean>>({
    option1: false,
    option2: true,
    option3: false,
  });

  const options = [
    { id: "option1", label: "Option 1" },
    { id: "option2", label: "Option 2 (checked by default)" },
    { id: "option3", label: "Option 3" },
  ];

  return (
    <Stack>
      <div className="space-y-3">
        {options.map((option) => (
          <Checkbox
            key={option.id}
            checked={checked[option.id]}
            onCheckedChange={(details) =>
              setChecked((prev) => ({
                ...prev,
                [option.id]: details.checked === true,
              }))
            }
          >
            <CheckboxControl />
            <CheckboxLabel>{option.label}</CheckboxLabel>
          </Checkbox>
        ))}
      </div>

      <div className="bg-accent rounded-md p-3 text-sm">
        <p className="font-medium">Checked options:</p>
        <p className="text-muted-foreground">
          {Object.entries(checked)
            .filter(([, isChecked]) => isChecked)
            .map(([id]) => id)
            .join(", ") || "None"}
        </p>
      </div>

      <Checkbox disabled>
        <CheckboxControl />
        <CheckboxLabel>Disabled checkbox</CheckboxLabel>
      </Checkbox>
    </Stack>
  );
}
