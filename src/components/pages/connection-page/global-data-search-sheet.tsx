import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { searchDatabaseDataQueryOptions } from "#src/server/introspection/start-fns/search-database-data.start.ts";

import type { DbConnection } from "../connection.types";

import { Button } from "../../ui/button.tsx";
import { Input } from "../../ui/input.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.tsx";

export const formatDatabaseSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const GlobalDataSearchSheet = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: DbConnection;
  schema: string;
  onOpenTable: (schema: string, table: string) => void;
}) => {
  const [term, setTerm] = useState("");
  const [submittedTerm, setSubmittedTerm] = useState("");
  const query = useQuery({
    ...searchDatabaseDataQueryOptions({
      url: props.connection.url,
      schema: props.schema,
      term: submittedTerm,
    }),
    enabled: props.open && submittedTerm.length >= 2,
  });

  useEffect(() => {
    if (!props.open) {
      setTerm("");
      setSubmittedTerm("");
    }
  }, [props.open]);

  return (
    <Sheet open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
      <SheetContent className="z-50 flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b">
          <SheetTitle>Search database</SheetTitle>
          <SheetDescription>
            Search text values in up to 60 tables in the current schema. Results are capped.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex gap-2 border-b p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const next = term.trim();
            if (next.length >= 2) setSubmittedTerm(next);
          }}
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search values…"
            aria-label="Search database values"
          />
          <Button type="submit" disabled={term.trim().length < 2}>
            <Search className="size-4" />
            Search
          </Button>
        </form>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {submittedTerm.length < 2 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Enter at least two characters to search.
            </div>
          ) : query.isLoading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Searching {props.schema}…
            </div>
          ) : query.isError ? (
            <div className="text-destructive text-sm">Search failed: {String(query.error)}</div>
          ) : query.data?.length ? (
            <div className="space-y-1" role="list" aria-label="Database search results">
              {query.data.map((result, index) => (
                <button
                  key={`${result.schema}.${result.table}.${result.column}.${index}`}
                  type="button"
                  className="hover:bg-muted block w-full rounded-md border px-3 py-2 text-left"
                  onClick={() => {
                    props.onOpenTable(result.schema, result.table);
                    props.onOpenChange(false);
                  }}
                >
                  <span className="text-foreground block truncate text-sm font-medium">
                    {result.table}.{result.column}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs">
                    {formatDatabaseSearchValue(result.value)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No matches for “{submittedTerm}”.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
