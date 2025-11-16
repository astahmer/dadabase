import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getRelationshipsCounts } from "./get-relationships-counts.kysely.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql, type ColumnType } from "kysely";
import type { TableRelationship } from "#src/types/relationships.ts";

interface TestInMemoryDbSchema {
	apps: {
		id: ColumnType<string, string, string>;
		name: ColumnType<string, string, string>;
	};
	activity_rooms: {
		id: ColumnType<string, string, string>;
		app_id: ColumnType<string, string, string>;
		name: ColumnType<string, string, string>;
	};
	activity_logs: {
		id: ColumnType<string, string, string>;
		room_id: ColumnType<string | null, string, string>;
		action: ColumnType<string, string, string>;
	};
	users: {
		id: ColumnType<string, string, string>;
		name: ColumnType<string, string, string>;
		app_id: ColumnType<string | null, string, string>;
	};
	comments: {
		id: ColumnType<string, string, string>;
		room_id: ColumnType<string, string, string>;
		user_id: ColumnType<string, string, string>;
		text: ColumnType<string, string, string>;
	};
}

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<TestInMemoryDbSchema>({
		dataDir: "memory://",
	}) as any,
) as any as Layer.Layer<KyselyPgDatabase, never, never>;

describe("getRelationshipsCounts", () => {
	// Helper to set up test schema
	const setupSchema = Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		// Create apps table
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS apps (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL
			)
		`);

		// Create activity_rooms with FK to apps
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS activity_rooms (
				id TEXT PRIMARY KEY,
				app_id TEXT NOT NULL REFERENCES apps(id),
				name TEXT NOT NULL
			)
		`);

		// Create activity_logs with nullable FK to activity_rooms
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS activity_logs (
				id TEXT PRIMARY KEY,
				room_id TEXT REFERENCES activity_rooms(id),
				action TEXT NOT NULL
			)
		`);

		// Create users with nullable FK to apps
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				app_id TEXT REFERENCES apps(id)
			)
		`);

		// Create comments with FK to both activity_rooms and users
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS comments (
				id TEXT PRIMARY KEY,
				room_id TEXT NOT NULL REFERENCES activity_rooms(id),
				user_id TEXT NOT NULL REFERENCES users(id),
				text TEXT NOT NULL
			)
		`);
	});

	// Helper to insert test data
	const insertTestData = Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		// Insert apps
		yield* db.insertInto("apps").values([
			{ id: "app-1", name: "App 1" },
			{ id: "app-2", name: "App 2" },
		]);

		// Insert activity_rooms for app-1 (parent row we'll query from)
		yield* db.insertInto("activity_rooms").values([
			{ id: "room-1", app_id: "app-1", name: "Room 1" },
			{ id: "room-2", app_id: "app-1", name: "Room 2" },
			{ id: "room-3", app_id: "app-1", name: "Room 3" },
			{ id: "room-4", app_id: "app-2", name: "Room 4" },
		]);

		// Insert activity_logs
		yield* db.insertInto("activity_logs").values([
			{ id: "log-1", room_id: "room-1", action: "open" },
			{ id: "log-2", room_id: "room-1", action: "close" },
			{ id: "log-3", room_id: "room-2", action: "open" },
			{ id: "log-4", room_id: null, action: "unknown" }, // null room_id
			{ id: "log-5", room_id: null, action: "unknown" },
		]);

		// Insert users
		yield* db.insertInto("users").values([
			{ id: "user-1", name: "User 1", app_id: "app-1" },
			{ id: "user-2", name: "User 2", app_id: "app-1" },
			{ id: "user-3", name: "User 3", app_id: "app-2" },
			{ id: "user-4", name: "User 4", app_id: null }, // null app_id
		]);

		// Insert comments
		yield* db.insertInto("comments").values([
			{ id: "c1", room_id: "room-1", user_id: "user-1", text: "Comment 1" },
			{ id: "c2", room_id: "room-1", user_id: "user-2", text: "Comment 2" },
			{ id: "c3", room_id: "room-1", user_id: "user-3", text: "Comment 3" },
			{ id: "c4", room_id: "room-2", user_id: "user-1", text: "Comment 4" },
			{ id: "c5", room_id: "room-4", user_id: "user-3", text: "Comment 5" },
		]);
	});

	it.effect(
		"counts rows for outgoing relationship (activity_rooms -> apps)",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const relationships: TableRelationship[] = [
					{
						constraintName: "activity_rooms_app_id_fkey",
						referencingSchema: "public",
						referencingTable: "activity_rooms",
						referencingColumn: "app_id",
						referencedSchema: "public",
						referencedTable: "apps",
						referencedColumn: "id",
						type: "outgoing",
					},
				];

				const rowData = { id: "app-1", name: "App 1" };

				const counts = yield* getRelationshipsCounts({
					schema: "public",
					table: "apps",
					relationships,
					rowData,
				});

				// app-1 has 3 activity_rooms
				expect(counts["activity_rooms_app_id_fkey"]).toBe(3);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect(
		"counts rows for incoming relationship (comments -> activity_rooms)",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const relationships: TableRelationship[] = [
					{
						constraintName: "comments_room_id_fkey",
						referencingSchema: "public",
						referencingTable: "comments",
						referencingColumn: "room_id",
						referencedSchema: "public",
						referencedTable: "activity_rooms",
						referencedColumn: "id",
						type: "incoming",
					},
				];

				const rowData = { id: "room-1", app_id: "app-1", name: "Room 1" };

				const counts = yield* getRelationshipsCounts({
					schema: "public",
					table: "activity_rooms",
					relationships,
					rowData,
				});

				// room-1 has 3 comments
				expect(counts["comments_room_id_fkey"]).toBe(3);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("counts multiple relationships at once", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const relationships: TableRelationship[] = [
				{
					constraintName: "activity_logs_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "activity_logs",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
				{
					constraintName: "comments_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "comments",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
			];

			const rowData = { id: "room-1", app_id: "app-1", name: "Room 1" };

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships,
				rowData,
			});

			// room-1 has 2 activity_logs and 3 comments
			expect(counts["activity_logs_room_id_fkey"]).toBe(2);
			expect(counts["comments_room_id_fkey"]).toBe(3);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles null filter values correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const relationships: TableRelationship[] = [
				{
					constraintName: "activity_logs_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "activity_logs",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
			];

			// room_id is null in rowData, so we should count all activity_logs with room_id IS NULL
			const rowData = { id: "activity_room_with_null" };

			// Need to query with a relation where the foreign column is null
			// Create a temporary table to test this scenario
			yield* (yield* KyselyPgDatabase).executeRaw(sql`
				INSERT INTO activity_logs (id, room_id, action)
				VALUES ('log-null-1', NULL, 'test'), ('log-null-2', NULL, 'test')
			`);

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships,
				rowData: { id: null }, // Simulating a null id
			});

			// When filtering by null, should count all logs with room_id IS NULL
			expect(counts["activity_logs_room_id_fkey"]).toBe(4); // 2 original + 2 new
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns zero count for rows with no related records", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const relationships: TableRelationship[] = [
				{
					constraintName: "activity_logs_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "activity_logs",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
			];

			// room-4 has only 1 activity_log but 0 comments
			const rowData = { id: "room-4", app_id: "app-2", name: "Room 4" };

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships,
				rowData,
			});

			expect(counts["activity_logs_room_id_fkey"]).toBe(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns empty object for empty relationships array", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships: [],
				rowData: { id: "room-1", app_id: "app-1", name: "Room 1" },
			});

			expect(counts).toEqual({});
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"counts relationships with numeric FK values correctly",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const relationships: TableRelationship[] = [
					{
						constraintName: "comments_user_id_fkey",
						referencingSchema: "public",
						referencingTable: "comments",
						referencingColumn: "user_id",
						referencedSchema: "public",
						referencedTable: "users",
						referencedColumn: "id",
						type: "incoming",
					},
				];

				// user-1 has 2 comments
				const rowData = { id: "user-1", name: "User 1", app_id: "app-1" };

				const counts = yield* getRelationshipsCounts({
					schema: "public",
					table: "users",
					relationships,
					rowData,
				});

				expect(counts["comments_user_id_fkey"]).toBe(2);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("correctly handles nullable foreign key columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const relationships: TableRelationship[] = [
				{
					constraintName: "users_app_id_fkey",
					referencingSchema: "public",
					referencingTable: "users",
					referencingColumn: "app_id",
					referencedSchema: "public",
					referencedTable: "apps",
					referencedColumn: "id",
					type: "incoming",
				},
			];

			const rowData = { id: "app-1", name: "App 1" };

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "apps",
				relationships,
				rowData,
			});

			// app-1 has 2 users (user-1 and user-2, user-4 has null app_id)
			expect(counts["users_app_id_fkey"]).toBe(2);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns object keyed by constraint name", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const relationships: TableRelationship[] = [
				{
					constraintName: "activity_logs_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "activity_logs",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
				{
					constraintName: "comments_room_id_fkey",
					referencingSchema: "public",
					referencingTable: "comments",
					referencingColumn: "room_id",
					referencedSchema: "public",
					referencedTable: "activity_rooms",
					referencedColumn: "id",
					type: "incoming",
				},
			];

			const rowData = { id: "room-1", app_id: "app-1", name: "Room 1" };

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships,
				rowData,
			});

			// Result should be keyed by constraint name
			expect(Object.keys(counts).sort()).toEqual([
				"activity_logs_room_id_fkey",
				"comments_room_id_fkey",
			]);
			expect(typeof counts["activity_logs_room_id_fkey"]).toBe("number");
			expect(typeof counts["comments_room_id_fkey"]).toBe("number");
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
