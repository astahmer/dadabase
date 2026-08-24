import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ChevronRight, Link as LinkIcon, Loader, X } from "lucide-react";

import type { ColumnReference } from "#src/server/introspection/introspection.ts";

import { findColumnReferencesWithCountsQueryOptions } from "#src/server/introspection/start-fns/find-column-references.start.ts";

import type { ForeignKeyInfo } from "../data-table/cell-context-menu.tsx";

import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Stack } from "../ui/layout.tsx";

interface InlineReferencesPopoverProps {
  schema: string;
  table: string;
  columnName: string;
  columnDataType: string;
  reference?: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
  };
  cellValue: unknown;
  connectionUrl: string;
  onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
  onNavigateToReference?: (ref: ColumnReference, cellValue: unknown) => void;
  onExpandToSheet?: () => void;
  onClose?: () => void;
}

export function InlineReferencesPopover({
  schema,
  table,
  columnName,
  reference,
  cellValue,
  connectionUrl,
  onNavigateToFK,
  onNavigateToReference,
  onExpandToSheet,
  onClose,
}: InlineReferencesPopoverProps) {
  // Determine the reference target
  const referenceTarget = reference
    ? {
        referencedSchema: reference.referencedSchema,
        referencedTable: reference.referencedTable,
        referencedColumn: reference.referencedColumn,
      }
    : {
        referencedSchema: schema,
        referencedTable: table,
        referencedColumn: columnName,
      };

  // Fetch reverse FK references
  const {
    data: reverseReferences = [],
    isLoading,
    error,
    refetch,
  } = useQuery(
    findColumnReferencesWithCountsQueryOptions({
      url: connectionUrl,
      referencedSchema: referenceTarget.referencedSchema,
      referencedTable: referenceTarget.referencedTable,
      referencedColumn: referenceTarget.referencedColumn,
      cellValue,
    }),
  );

  if (cellValue === null) {
    return (
      <div className="max-w-2xl min-w-80 rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-amber-900 dark:text-amber-100">
            Cannot display relationships for NULL values
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl min-w-80">
        <ErrorBoundaryCard
          error={error}
          title="Error loading relationships"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="bg-background border-border max-w-2xl min-w-80 overflow-hidden rounded-lg border shadow-lg">
      {/* Header */}
      <div className="border-border bg-muted/30 flex items-center justify-between border-b px-3 py-2">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
          <LinkIcon className="h-3 w-3" />
          <span>Relationships</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="hover:bg-muted/70 text-muted-foreground rounded p-1 transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Subheader with cell value */}
      <div className="text-muted-foreground border-border/50 truncate border-b px-3 py-1.5 text-xs">
        <code className="text-foreground font-mono">{columnName}</code> ={" "}
        {String(cellValue).slice(0, 150)}
        {String(cellValue).length > 150 ? "..." : ""}
      </div>

      {/* Content */}
      <Stack className="max-h-72 w-full space-y-3 overflow-y-auto p-3">
        {/* Forward FK */}
        {reference && (
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-semibold">
              <ChevronRight className="h-3 w-3" />
              From source table
            </div>
            <button
              onClick={() => {
                if (onNavigateToFK && reference && cellValue !== null) {
                  onNavigateToFK(
                    {
                      referencedSchema: reference.referencedSchema,
                      referencedTable: reference.referencedTable,
                      referencedColumn: reference.referencedColumn,
                      constraintName: "", // Empty for FK navigation
                    },
                    cellValue,
                  );
                }
              }}
              className="hover:bg-muted/70 flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-xs transition-colors"
            >
              <span>
                <span className="text-muted-foreground">{reference.referencedTable}.</span>
                <span className="font-medium">{reference.referencedColumn}</span>
              </span>
              <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0" />
            </button>
          </div>
        )}{" "}
        {/* Reverse References */}
        {reverseReferences && reverseReferences.length > 0 && (
          <div className="w-full">
            <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-semibold">
              <ChevronRight className="h-3 w-3" />
              Referenced By
              {!isLoading && <span className="ml-auto">({reverseReferences.length})</span>}
              {isLoading && (
                <Loader className="text-muted-foreground ml-auto h-3 w-3 animate-spin" />
              )}
            </div>

            {!isLoading && (
              <div className="space-y-1">
                {reverseReferences.map((ref) => (
                  <button
                    key={`${ref.schema}.${ref.table}.${ref.column}`}
                    onClick={() => {
                      if (onNavigateToReference) {
                        onNavigateToReference(ref, cellValue);
                      }
                    }}
                    className="hover:bg-muted/70 flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-xs transition-colors"
                  >
                    <span>
                      <span className="text-muted-foreground">{ref.table}.</span>
                      <span className="font-medium">{ref.column}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      {ref.matchingRowCount?.toLocaleString() ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Loading State */}
        {isLoading && !reverseReferences.length && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
            <Loader className="h-3 w-3 animate-spin" />
            <span>Loading relationships...</span>
          </div>
        )}
        {/* No References State */}
        {!isLoading && !reference && reverseReferences.length === 0 && (
          <div className="text-muted-foreground py-2 text-xs">No relationships found</div>
        )}
      </Stack>

      {/* Footer */}
      {onExpandToSheet && (
        <div className="border-border bg-muted/20 border-t px-3 py-2">
          <button
            onClick={onExpandToSheet}
            className="hover:bg-muted/70 text-foreground w-full rounded py-1.5 text-center text-xs font-medium transition-colors"
          >
            Expand panel →
          </button>
        </div>
      )}
    </div>
  );
}
