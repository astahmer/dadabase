import {
  Combobox,
  ComboboxClearTrigger,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "#src/components/ui/combobox.tsx";
import { lookupFkValuesServerFn } from "#src/server/introspection/start-fns/lookup-fk-values.start.ts";
import { createListCollection } from "@ark-ui/react/combobox";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface FkColumnSelectProps {
  connectionUrl: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export function FkColumnSelect(props: FkColumnSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const search = inputValue.trim();

  const optionsQuery = useQuery({
    queryKey: [
      "fk-lookup",
      props.connectionUrl,
      props.referencedSchema,
      props.referencedTable,
      props.referencedColumn,
      search,
    ],
    queryFn: () =>
      lookupFkValuesServerFn({
        data: {
          url: props.connectionUrl,
          schema: props.referencedSchema,
          table: props.referencedTable,
          valueColumn: props.referencedColumn,
          labelColumn: props.referencedColumn,
          search: search || undefined,
          limit: 50,
        },
      }),
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const options = optionsQuery.data ?? [];
    const mapped = options.map((opt) => ({
      label: opt.label,
      value: String(opt.value),
      rawValue: opt.value,
    }));

    // Ensure current value stays selectable even if not in the latest page
    if (props.value != null && !mapped.some((item) => item.value === String(props.value))) {
      mapped.unshift({
        label: String(props.value),
        value: String(props.value),
        rawValue: props.value as string | number | boolean | null,
      });
    }

    return mapped;
  }, [optionsQuery.data, props.value]);

  const collection = useMemo(() => createListCollection({ items }), [items]);

  return (
    <Combobox
      collection={collection}
      value={props.value == null ? [] : [String(props.value)]}
      disabled={props.disabled}
      inputValue={inputValue}
      onInputValueChange={(details) => setInputValue(details.inputValue)}
      onValueChange={(details) => {
        const selected = details.value[0];
        if (selected == null) {
          props.onChange(null);
          return;
        }
        const match = items.find((item) => item.value === selected);
        props.onChange(match?.rawValue ?? selected);
      }}
      positioning={{ sameWidth: true }}
    >
      <ComboboxControl>
        <ComboboxInput placeholder="Search referenced values…" data-testid="fk-column-select" />
        {props.value != null && <ComboboxClearTrigger />}
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxList>
          {items.map((item) => (
            <ComboboxItem key={item.value} item={item}>
              {item.label}
            </ComboboxItem>
          ))}
          {items.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              {optionsQuery.isLoading ? "Loading…" : "No matches"}
            </div>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
