import { z } from "zod";

/**
 * Shared zod schemas for the dadabase-specific chat tools. The /api/chat route
 * uses them as tool inputSchema; unit tests import the same definitions so the
 * wire contract cannot drift between server and tests.
 */

const WORKSPACE_FILTER_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "is_null",
  "is_not_null",
] as const;

/** Subset of the workspace FilterOperator union the model may emit. */
export const WorkspaceFilterConditionSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(WORKSPACE_FILTER_OPERATORS),
  /** Required for value-carrying operators; omit for is_null/is_not_null. */
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const WorkspaceOrderBySchema = z.object({
  column: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
});

/** open_workspace_view: offer opening a browse tab pre-configured on a table. */
export const OpenWorkspaceViewInputSchema = z.object({
  table: z.string().min(1),
  schema: z.string().optional(),
  filters: z.array(WorkspaceFilterConditionSchema).max(10).optional(),
  orderBy: WorkspaceOrderBySchema.optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

/** preview_rows: peek at a capped number of sample rows. */
export const PreviewRowsInputSchema = z.object({
  table: z.string().min(1),
  schema: z.string().optional(),
  limit: z.number().int().positive().max(25).default(8),
});

/** table_details: columns/types/PK/FK/indexes for one table. */
export const TableDetailsInputSchema = z.object({
  table: z.string().min(1),
  schema: z.string().optional(),
});

/** explain_sql: query plan before propose_sql. */
export const ExplainSqlInputSchema = z.object({
  sql: z.string().min(1),
});

export type OpenWorkspaceViewInput = z.infer<typeof OpenWorkspaceViewInputSchema>;
export type PreviewRowsInput = z.infer<typeof PreviewRowsInputSchema>;
export type TableDetailsInput = z.infer<typeof TableDetailsInputSchema>;
export type ExplainSqlInput = z.infer<typeof ExplainSqlInputSchema>;
