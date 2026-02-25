import {
  Combobox,
  ComboboxClearTrigger,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemGroup,
  ComboboxItemGroupLabel,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "#src/components/ui/combobox.tsx";
import { useFilter } from "@ark-ui/react";
import { createListCollection } from "@ark-ui/react/combobox";
import { useState } from "react";

import { Stack } from "./layout.tsx";

const frameworks = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Angular", value: "angular" },
  { label: "Svelte", value: "svelte" },
  { label: "Astro", value: "astro" },
];

const databases = [
  { label: "PostgreSQL", value: "postgres" },
  { label: "MySQL", value: "mysql" },
  { label: "MongoDB", value: "mongodb" },
  { label: "SQLite", value: "sqlite" },
];

export function ComboboxExample() {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });

  const collection = createListCollection({
    items: [...frameworks, ...databases],
  });

  const filteredItems = collection.items.filter(
    (item) => !inputValue || contains(item.label, inputValue),
  );

  return (
    <Stack>
      <div className="space-y-2">
        <Combobox
          collection={collection}
          value={selectedFramework ? [selectedFramework] : []}
          onValueChange={(details) => setSelectedFramework(details.value[0])}
          inputValue={inputValue}
          onInputValueChange={(details) => setInputValue(details.inputValue)}
          positioning={{ sameWidth: true }}
        >
          <ComboboxLabel>Select a framework or database</ComboboxLabel>
          <ComboboxControl>
            <ComboboxInput placeholder="Search..." />
            {selectedFramework && <ComboboxClearTrigger />}
            <ComboboxTrigger />
          </ComboboxControl>
          <ComboboxContent>
            <ComboboxList>
              <ComboboxItemGroup>
                <ComboboxItemGroupLabel>Frameworks</ComboboxItemGroupLabel>
                {filteredItems
                  .filter((item) => frameworks.find((f) => f.value === item.value))
                  .map((item) => (
                    <ComboboxItem key={item.value} item={item}>
                      {item.label}
                    </ComboboxItem>
                  ))}
              </ComboboxItemGroup>

              <ComboboxItemGroup>
                <ComboboxItemGroupLabel>Databases</ComboboxItemGroupLabel>
                {filteredItems
                  .filter((item) => databases.find((d) => d.value === item.value))
                  .map((item) => (
                    <ComboboxItem key={item.value} item={item}>
                      {item.label}
                    </ComboboxItem>
                  ))}
              </ComboboxItemGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {selectedFramework && (
        <div className="bg-accent rounded-md p-3 text-sm">
          <p className="text-accent-foreground font-medium">
            Selected: <span className="font-semibold">{selectedFramework}</span>
          </p>
        </div>
      )}
    </Stack>
  );
}
