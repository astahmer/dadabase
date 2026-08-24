import { createListCollection } from "@ark-ui/react/select";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemGroup,
  SelectItemGroupLabel,
  SelectLabel,
  SelectTrigger,
  SelectValueText,
} from "#src/components/ui/select.tsx";

import { Stack } from "./layout.tsx";

const countries = [
  { label: "United States", value: "us" },
  { label: "Canada", value: "ca" },
  { label: "Mexico", value: "mx" },
];

const cities = [
  { label: "Paris", value: "paris" },
  { label: "London", value: "london" },
  { label: "Berlin", value: "berlin" },
];

export function SelectExample() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const collection = createListCollection({
    items: [...countries, ...cities],
  });

  return (
    <Stack>
      <div className="space-y-2">
        <Select
          collection={collection}
          value={selectedCountry ? [selectedCountry] : []}
          onValueChange={(details) => setSelectedCountry(details.value[0])}
          positioning={{ sameWidth: true }}
        >
          <SelectLabel>Select a country or city</SelectLabel>
          <SelectTrigger>
            <SelectValueText placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItemGroup>
              <SelectItemGroupLabel>Countries</SelectItemGroupLabel>
              {countries.map((item) => (
                <SelectItem key={item.value} item={item}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectItemGroup>
            <SelectItemGroup>
              <SelectItemGroupLabel>Cities</SelectItemGroupLabel>
              {cities.map((item) => (
                <SelectItem key={item.value} item={item}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectItemGroup>
          </SelectContent>
        </Select>
      </div>

      {selectedCountry && (
        <div className="bg-accent rounded-md p-3 text-sm">
          <p className="font-medium">
            Selected: <span className="font-semibold">{selectedCountry}</span>
          </p>
        </div>
      )}
    </Stack>
  );
}
