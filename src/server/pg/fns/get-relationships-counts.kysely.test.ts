import { PgLiteClient } from "@dadabase/effect-pglite";
import { getRelationshipsCounts } from "#src/server/introspection/introspection.ts";
import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

// PgLite layer for introspection tests
const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

// Type for relationship input matching introspection module
interface TableRelationship {
	constraintName: string;
	referencingSchema: string;
	referencingTable: string;
	referencingColumn: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	type: "incoming" | "outgoing";
}

describe("getRelationshipsCounts", () => {
	// Helper to set up test schema
	const setupSchema = Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		// Create apps table
		yield* client`
			CREATE TABLE IF NOT EXISTS apps (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL
			)
		`;

		// Create activity_rooms with FK to apps
		yield* client`
			CREATE TABLE IF NOT EXISTS activity_rooms (
				id TEXT PRIMARY KEY,
				app_id TEXT NOT NULL REFERENCES apps(id),
				name TEXT NOT NULL
			)
		`;

		// Create activity_logs with nullable FK to activity_rooms
		yield* client`
			CREATE TABLE IF NOT EXISTS activity_logs (
				id TEXT PRIMARY KEY,
				room_id TEXT REFERENCES activity_rooms(id),
				action TEXT NOT NULL
			)
		`;

		// Create users with nullable FK to apps
		yield* client`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				app_id TEXT REFERENCES apps(id)
			)
		`;

		// Create comments with FK to both activity_rooms and users
		yield* client`
			CREATE TABLE IF NOT EXISTS comments (
				id TEXT PRIMARY KEY,
				room_id TEXT NOT NULL REFERENCES activity_rooms(id),
				user_id TEXT NOT NULL REFERENCES users(id),
				text TEXT NOT NULL
			)
		`;
	});

	// Helper to insert test data
	const insertTestData = Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		// Insert apps
		yield* client`
			INSERT INTO apps (id, name) VALUES ('app-1', 'App 1'), ('app-2', 'App 2')
		`;

		// Insert activity_rooms for app-1 (parent row we'll query from)
		yield* client`
			INSERT INTO activity_rooms (id, app_id, name) VALUES
			('room-1', 'app-1', 'Room 1'),
			('room-2', 'app-1', 'Room 2'),
			('room-3', 'app-1', 'Room 3'),
			('room-4', 'app-2', 'Room 4')
		`;

		// Insert activity_logs
		yield* client`
			INSERT INTO activity_logs (id, room_id, action) VALUES
			('log-1', 'room-1', 'open'),
			('log-2', 'room-1', 'close'),
			('log-3', 'room-2', 'open'),
			('log-4', NULL, 'unknown'),
			('log-5', NULL, 'unknown')
		`;

		// Insert users
		yield* client`
			INSERT INTO users (id, name, app_id) VALUES
			('user-1', 'User 1', 'app-1'),
			('user-2', 'User 2', 'app-1'),
			('user-3', 'User 3', 'app-2'),
			('user-4', 'User 4', NULL)
		`;

		// Insert comments
		yield* client`
			INSERT INTO comments (id, room_id, user_id, text) VALUES
			('c1', 'room-1', 'user-1', 'Comment 1'),
			('c2', 'room-1', 'user-2', 'Comment 2'),
			('c3', 'room-1', 'user-3', 'Comment 3'),
			('c4', 'room-2', 'user-1', 'Comment 4'),
			('c5', 'room-4', 'user-3', 'Comment 5')
		`;
	});

	it.effect(
		"counts rows for incoming relationship (activity_rooms -> apps)",
		() =>
			Effect.gen(function* () {
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

				// app-1 has 3 activity_rooms
				expect(counts["activity_rooms_app_id_fkey"]).toBe(3);
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect(
		"counts rows for incoming relationship (comments -> activity_rooms)",
		() =>
			Effect.gen(function* () {
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
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("counts multiple relationships at once", () =>
		Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect(
		"counts rows for outgoing relationship (activity_rooms.app_id -> apps)",
		() =>
			Effect.gen(function* () {
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

				// We're in activity_rooms table with app_id: "app-1"
				// This outgoing relationship counts other activity_rooms with the same app_id
				const rowData = { id: "room-1", app_id: "app-1", name: "Room 1" };

				const counts = yield* getRelationshipsCounts({
					schema: "public",
					table: "activity_rooms",
					relationships,
					rowData,
				});

				// Count activity_rooms WHERE app_id = "app-1" (which includes room-1, room-2, room-3 = 3)
				expect(counts["activity_rooms_app_id_fkey"]).toBe(3);
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("ignores relationships when filter value is null", () =>
		Effect.gen(function* () {
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

			// When the filter value (id) is null, the relationship is ignored entirely
			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships,
				rowData: { id: null }, // Null id means this relationship is filtered out
			});

			// Null relationships are not included in the result
			expect(counts["activity_logs_room_id_fkey"]).toBeUndefined();
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns zero count for rows with no related records", () =>
		Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns empty object for empty relationships array", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const counts = yield* getRelationshipsCounts({
				schema: "public",
				table: "activity_rooms",
				relationships: [],
				rowData: { id: "room-1", app_id: "app-1", name: "Room 1" },
			});

			expect(counts).toEqual({});
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("counts relationships with numeric FK values correctly", () =>
		Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("correctly handles nullable foreign key columns", () =>
		Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns object keyed by constraint name", () =>
		Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer)),
	);
});
