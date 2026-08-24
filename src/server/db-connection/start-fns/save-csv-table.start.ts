import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { guardReadOnlyMutation, stripDadabaseMarkerParams } from "#src/lib/connection-security.ts";

import { AppRuntime } from "../../services/app.runtime.ts";
import { saveCsvTable } from "../duckdb/csv-client.ts";

/**
 * Explicit per-table Save for CSV connections (§B.3): exports the edited
 * in-memory DuckDB table back to its source csv file atomically
 * (tmp → rename, previous file kept as `.bak`). No auto-save.
 */
export const saveCsvTableServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      table: Schema.String,
    }).pipe(toValidator),
  )
  .handler(async (ctx) => {
    const readOnlyError = guardReadOnlyMutation(ctx.data.url);
    if (readOnlyError) return { success: false as const, message: readOnlyError };

    const url = stripDadabaseMarkerParams(ctx.data.url);
    const path = url.startsWith("file:") ? url.slice("file:".length) : url;

    try {
      const result = await AppRuntime.runPromise(saveCsvTable(path, ctx.data.table));
      return { success: true as const, ...result };
    } catch (error) {
      return {
        success: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
