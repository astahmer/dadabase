import * as sql from "effect/unstable/sql";

/**
 * Effect 4 moved `@effect/sql/SqlError` into the `effect/unstable/sql` barrel.
 * Re-exposed here as a single binding so call sites keep importing
 * `{ SqlError }` from this module for both type positions
 * (`Effect.Effect<A, SqlError>`) and construction (`new SqlError({...})`).
 */
class CompatSqlError extends sql.SqlError.SqlError {
  constructor(args: { cause?: unknown; message?: string; operation?: string });
  constructor(args: { reason: InstanceType<(typeof sql.SqlError)["UnknownError"]> });
  constructor(args: { reason?: unknown; cause?: unknown; message?: string; operation?: string }) {
    // Preserve the underlying cause's own message (v3 behaviour): the reason's
    // `message` getter otherwise falls back to the tag name ("UnknownError").
    const causeMessage =
      args.message ??
      (typeof (args.cause as { message?: unknown } | undefined)?.message === "string"
        ? (args.cause as { message: string }).message
        : undefined);
    const rawCause = args.reason === undefined ? args.cause : undefined;
    super({
      reason:
        (args.reason as InstanceType<(typeof sql.SqlError)["UnknownError"]>) ??
        new sql.SqlError.UnknownError({
          cause: args.cause,
          ...(causeMessage !== undefined ? { message: causeMessage } : {}),
          ...(args.operation !== undefined ? { operation: args.operation } : {}),
        }),
    });
    if (rawCause !== undefined) {
      // v3 exposed the RAW error as `.cause`; v4 points `.cause` at the tagged
      // reason. Consumers introspect driver codes (e.g. "ECONNREFUSED") off of
      // `.cause`, so restore the raw binding.
      Object.defineProperty(this, "cause", {
        value: rawCause,
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

export { CompatSqlError as SqlError };

import * as Schema from "effect/Schema";

/**
 * Effect v4's `Schema.toStandardSchemaV1` returns `StandardSchemaV1 & S`; the
 * `& S` half leaks effect-Schema-specific props (`DecodingServices`, …) which
 * break TanStack Start's serializable-validator constraints. This wrapper
 * returns only a minimal plain `~standard` surface.
 */
export const toValidator = <S extends { readonly Encoded: unknown; readonly Type: unknown }>(
  schema: S,
): {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: "effect";
    // NOTE: validator schemas must keep their Encoded side wire-serializable
    // (e.g. use `Schema.String`, not `Schema.URL`, for connection urls) or
    // TanStack Start's strict serializable constraint rejects them.
    readonly types?: { readonly input: S["Encoded"]; readonly output: S["Type"] } | undefined;
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: S["Type"]; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string }> };
  };
} => Schema.toStandardSchemaV1(schema as never) as never;
