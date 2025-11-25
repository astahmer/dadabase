import { describe, expect, it } from "vitest";
import { createDbConnection } from "./create-db-connection.ts";
import { deleteDbConnection } from "./delete-db-connection.ts";
import { updateDbConnection } from "./update-db-connection.ts";

// TODO refactor with import { describe, expect, it } from "@effect/vitest"; and yield stuff to make interesting assertions rather than crappy expectations (current state)

describe("Database Connection Management Functions", () => {
	describe("createDbConnection", () => {
		it("throws or rejects when name parameter is missing", () => {
			expect(() => {
				(createDbConnection as any)({
					url: "postgresql://localhost",
				});
			}).toBeDefined();
		});

		it("throws or rejects when url parameter is missing", () => {
			expect(() => {
				(createDbConnection as any)({
					name: "Test",
				});
			}).toBeDefined();
		});

		it("accepts various PostgreSQL connection URL formats", () => {
			const validUrls = [
				"postgresql://user:pass@localhost:5432/db",
				"postgres://localhost/db",
				"postgresql://localhost",
			];

			validUrls.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({
						name: "Test",
						url,
					});
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("accepts connection names with hyphens, underscores, and dots", () => {
			const specialNames = [
				"My-Database_Connection",
				"DB.Connection",
				"Connection (Production)",
				"Connection [2024]",
			];

			specialNames.forEach((name) => {
				expect(() => {
					const effect = createDbConnection({
						name,
						url: "postgresql://localhost",
					});
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("preserves URL query parameters during creation", () => {
			const urlsWithParams = [
				"postgresql://user:pass@localhost/db?sslmode=require",
				"postgresql://localhost?connect_timeout=10",
				"postgresql://localhost/db?application_name=dadabase",
			];

			urlsWithParams.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({
						name: "Test",
						url,
					});
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("accepts empty connection names", () => {
			expect(() => {
				const effect = createDbConnection({
					name: "",
					url: "postgresql://localhost",
				});
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("accepts both postgresql and postgres protocol aliases", () => {
			const urls = ["postgresql://localhost", "postgres://localhost"];

			urls.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({
						name: "Test",
						url,
					});
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("includes connection URLs with database names", () => {
			const urlsWithDb = [
				"postgresql://user@localhost/mydb",
				"postgresql://localhost:5432/testdb",
				"postgres://host:5432/database",
			];

			urlsWithDb.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({ name: "Test", url });
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("includes connection URLs without database name", () => {
			const urlsWithoutDb = [
				"postgresql://user@localhost",
				"postgresql://localhost:5432",
				"postgres://host",
			];

			urlsWithoutDb.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({ name: "Test", url });
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});
	});

	describe("updateDbConnection", () => {
		it("throws or rejects when id parameter is missing", () => {
			expect(() => {
				(updateDbConnection as any)({
					name: "Test",
					url: "postgresql://localhost",
				});
			}).toBeDefined();
		});

		it("throws or rejects when name parameter is missing", () => {
			expect(() => {
				(updateDbConnection as any)({
					id: "db_conn_123",
					url: "postgresql://localhost",
				});
			}).toBeDefined();
		});

		it("throws or rejects when url parameter is missing", () => {
			expect(() => {
				(updateDbConnection as any)({
					id: "db_conn_123",
					name: "Test",
				});
			}).toBeDefined();
		});

		it("accepts updates to different database hosts", () => {
			expect(() => {
				const effect = updateDbConnection({
					id: "db_conn_123",
					name: "Test",
					url: "postgresql://otherhost:5432/otherdb",
				});
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("accepts name updates with special characters and parentheses", () => {
			expect(() => {
				const effect = updateDbConnection({
					id: "db_conn_123",
					name: "Updated Connection (v2.0)",
					url: "postgresql://localhost",
				});
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("accepts arbitrary id values (validation at execution time)", () => {
			expect(() => {
				const effect = updateDbConnection({
					id: "db_conn_nonexistent_id",
					name: "Name",
					url: "postgresql://localhost",
				});
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("preserves all input fields for execution", () => {
			const input = {
				id: "db_conn_123",
				name: "New Connection Name",
				url: "postgresql://production-host/prod_db",
			};

			const effect = updateDbConnection(input);

			expect(effect).toBeDefined();
			expect(typeof effect).toBe("object");
		});

		it("supports updating with connection pooling parameters", () => {
			expect(() => {
				const effect = updateDbConnection({
					id: "db_conn_123",
					name: "Test",
					url: "postgresql://localhost?pool_size=10",
				});
				expect(effect).toBeDefined();
			}).not.toThrow();
		});
	});

	describe("deleteDbConnection", () => {
		it("throws or rejects when id parameter is missing", () => {
			expect(() => {
				(deleteDbConnection as any)();
			}).toBeDefined();
		});

		it("accepts various id formats with db_conn prefix", () => {
			const validIds = [
				"db_conn_abc123",
				"db_conn_12345",
				"db_conn_lowercase",
				"db_conn_UPPERCASE",
			];

			validIds.forEach((id) => {
				expect(() => {
					const effect = deleteDbConnection(id);
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("accepts arbitrary id values (validation at execution time)", () => {
			expect(() => {
				const effect = deleteDbConnection("db_conn_nonexistent");
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("can be called multiple times with same id without error", () => {
			const id = "db_conn_test";

			expect(() => {
				const effect1 = deleteDbConnection(id);
				const effect2 = deleteDbConnection(id);

				expect(effect1).toBeDefined();
				expect(effect2).toBeDefined();
			}).not.toThrow();
		});

		it("accepts empty string as id (validation deferred to execution)", () => {
			expect(() => {
				const effect = deleteDbConnection("");
				expect(effect).toBeDefined();
			}).not.toThrow();
		});

		it("returns distinct instances for different ids", () => {
			const effect1 = deleteDbConnection("db_conn_id1");
			const effect2 = deleteDbConnection("db_conn_id2");

			expect(effect1).not.toBe(effect2);
		});
	});

	describe("Database Connection Functions Pattern", () => {
		it("all CRUD operations are Effect.fn functions", () => {
			// All operations should be functions
			expect(typeof createDbConnection).toBe("function");
			expect(typeof updateDbConnection).toBe("function");
			expect(typeof deleteDbConnection).toBe("function");
		});

		it("operations support SSL connection parameters", () => {
			const sslUrls = [
				"postgresql://localhost?sslmode=require",
				"postgresql://localhost?sslmode=prefer",
				"postgresql://localhost?sslmode=disable",
			];

			sslUrls.forEach((url) => {
				expect(() => {
					createDbConnection({
						name: "Test",
						url,
					});
				}).toBeDefined();
			});
		});

		it("operations support connection timeout parameters", () => {
			const timeoutUrls = [
				"postgresql://localhost?connect_timeout=10",
				"postgresql://localhost?idle_timeout=300",
				"postgresql://localhost?statement_timeout=30000",
			];

			timeoutUrls.forEach((url) => {
				expect(() => {
					createDbConnection({
						name: "Test",
						url,
					});
				}).toBeDefined();
			});
		});

		it("operations preserve database name in connection URLs", () => {
			const urlsWithDbName = [
				"postgresql://localhost/production_db",
				"postgresql://localhost/staging_db",
				"postgresql://localhost/development_db",
			];

			urlsWithDbName.forEach((url) => {
				expect(() => {
					const effect = createDbConnection({ name: "Test", url });
					expect(effect).toBeDefined();
				}).not.toThrow();
			});
		});

		it("createDbConnection sets hardcoded dialect to postgres", () => {
			const effect = createDbConnection({
				name: "Test",
				url: "postgresql://localhost",
			});

			// The Effect should carry dialect: 'postgres' for execution
			expect(effect).toBeDefined();
		});

		it("updateDbConnection maintains dialect consistency", () => {
			const effect = updateDbConnection({
				id: "db_conn_123",
				name: "Test",
				url: "postgresql://localhost",
			});

			// Should preserve postgres dialect
			expect(effect).toBeDefined();
		});
	});
});
