import { createServerFn } from "@tanstack/react-start";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { Schema } from "effect";
import {
	getQueryLogs,
	getFavorites,
	saveFavorite,
	deleteFavorite,
	deleteQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

/**
 * Fetch persisted query logs from the database for a connection
 */
const GetQueryLogsInputSchema = Schema.Struct({
	connectionId: Schema.String,
	limit: Schema.Number.pipe(Schema.optional),
});

export const getPersistedQueryLogsServerFn = createServerFn({ method: "POST" })
	.inputValidator(GetQueryLogsInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const { connectionId, limit } = ctx.data;
		return AppRuntime.runPromise(getQueryLogs(connectionId, limit));
	});

/**
 * Fetch saved query favorites for a connection
 */
const GetFavoritesInputSchema = Schema.Struct({
	connectionId: Schema.String,
});

export const getQueryFavoritesServerFn = createServerFn({ method: "POST" })
	.inputValidator(GetFavoritesInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const { connectionId } = ctx.data;
		return AppRuntime.runPromise(getFavorites(connectionId));
	});

/**
 * Save a query as a favorite
 */
const SaveFavoriteInputSchema = Schema.Struct({
	connectionId: Schema.String,
	label: Schema.String,
	sql: Schema.String,
	description: Schema.String.pipe(Schema.optional),
});

export const saveQueryFavoriteServerFn = createServerFn({ method: "POST" })
	.inputValidator(SaveFavoriteInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const { connectionId, label, sql, description } = ctx.data;
		return AppRuntime.runPromise(
			saveFavorite({
				connectionId,
				label,
				sql,
				description,
			}),
		);
	});

/**
 * Delete a saved query favorite
 */
const DeleteFavoriteInputSchema = Schema.Struct({
	id: Schema.String,
});

export const deleteQueryFavoriteServerFn = createServerFn({ method: "POST" })
	.inputValidator(DeleteFavoriteInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const { id } = ctx.data;
		return AppRuntime.runPromise(deleteFavorite(id));
	});

/**
 * Delete a query log entry
 */
const DeleteLogInputSchema = Schema.Struct({
	id: Schema.String,
});

export const deleteQueryLogServerFn = createServerFn({ method: "POST" })
	.inputValidator(DeleteLogInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const { id } = ctx.data;
		return AppRuntime.runPromise(deleteQueryLog(id));
	});
