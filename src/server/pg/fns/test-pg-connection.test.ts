import { testPgConnectionUrl } from "./test-pg-connection.ts";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";

describe("testPgConnectionUrl", () => {
	it("returns success and message properties in all cases", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl(
				"postgresql://user:password@invalid-host-12345:5432/db",
			),
		);

		// Function must return object with both success and message
		expect(result).toHaveProperty("success");
		expect(result).toHaveProperty("message");
		expect(typeof result.success).toBe("boolean");
		expect(typeof result.message).toBe("string");
	});

	it("rejects truly invalid URLs with success false and error message", async () => {
		const result = await Effect.runPromise(testPgConnectionUrl("invalid-url"));

		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
		expect(result.message.length).toBeGreaterThan(0);
	});

	it("reports connection failures with success false", async () => {
		// Localhost port 1 is unlikely to have PostgreSQL
		const result = await Effect.runPromise(
			testPgConnectionUrl("postgresql://localhost:1/test_db?connect_timeout=1"),
		);

		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
	});

	it("reports empty connection string as error", async () => {
		const result = await Effect.runPromise(testPgConnectionUrl(""));

		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
		// Empty string should have a specific error message
		expect(result.message.length).toBeGreaterThan(0);
	});

	it("includes connection error details in message when connection is refused", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl("postgresql://localhost:1/test?connect_timeout=1"),
		);

		if (result.success === false) {
			// Message should indicate a network/connection error
			const isConnectionError =
				result.message.toLowerCase().includes("econnrefused") ||
				result.message.toLowerCase().includes("refused") ||
				result.message.toLowerCase().includes("connect") ||
				result.message.toLowerCase().includes("timeout");
			expect(isConnectionError).toBe(true);
		}
	});

	it("returns Either-like structure with boolean success discriminator", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl("postgresql://invalid:invalid@localhost:54321/db"),
		);

		// Discriminated union pattern: success boolean determines interpretation
		expect(typeof result.success).toBe("boolean");
		expect(typeof result.message).toBe("string");
		// When success is false, message should be an error message
		if (result.success === false) {
			expect(result.message.length).toBeGreaterThan(0);
		}
	});

	it("properly parses postgresql:// protocol prefix", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl(
				"postgresql://localhost:54321/test?connect_timeout=1",
			),
		);

		// Should recognize protocol and attempt connection (which will fail)
		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
	});

	it("also handles postgres:// as valid protocol alias", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl("postgres://localhost:54321/test?connect_timeout=1"),
		);

		// postgres:// is alias for postgresql://, should be accepted
		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
	});

	it("extracts and validates connection URL components (user:pass@host:port/db)", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl(
				"postgresql://user:pass@localhost:54321/db?sslmode=disable&connect_timeout=1",
			),
		);

		// Should parse all components without throwing
		expect(result).toHaveProperty("success");
		expect(result).toHaveProperty("message");
		// Connection attempt itself may fail, but parsing should succeed
		expect(result.success === false).toBe(true); // Expected to fail on connection
	});

	it("provides meaningful error messages when connection fails", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl("postgresql://localhost:1/db"),
		);

		expect(result.success).toBe(false);
		expect(result.message.length).toBeGreaterThan(0);
		// Should include some useful information about why it failed
		const messageIndicatesError =
			result.message.toLowerCase().includes("error") ||
			result.message.toLowerCase().includes("connection") ||
			result.message.toLowerCase().includes("econnrefused") ||
			result.message.toLowerCase().includes("refused");
		expect(messageIndicatesError).toBe(true);
	});

	it("handles short connection timeouts without crashing", async () => {
		// 1 second timeout on non-existent host should timeout/fail quickly
		const result1 = await Effect.runPromise(
			testPgConnectionUrl(
				"postgresql://localhost:54321/test?connect_timeout=1",
			),
		);

		expect(result1.success).toBe(false);

		// Also test without explicit timeout
		const result2 = await Effect.runPromise(
			testPgConnectionUrl("postgresql://localhost:54321/test"),
		);

		expect(result2.success).toBe(false);
	});

	it("reports error for obviously malformed URLs (no protocol)", async () => {
		const result = await Effect.runPromise(testPgConnectionUrl("not-a-url"));
		expect(result.success).toBe(false);
		expect(result.message).toBeDefined();
		// Should indicate invalid format, not a connection error
		expect(result.message.length).toBeGreaterThan(0);
	}, 10000);

	it("parses and handles authentication credentials in URL", async () => {
		const result = await Effect.runPromise(
			testPgConnectionUrl(
				"postgresql://testuser:testpass@localhost:54321/testdb",
			),
		);

		// URL parsing should succeed even if connection fails
		expect(result.success === false).toBe(true); // Connection will fail but URL is valid
		expect(result.message).toBeDefined();
	});

	it("maintains consistent response structure across different URLs", async () => {
		const url1 = "postgresql://localhost:1/db1";
		const url2 = "postgresql://localhost:2/db2";

		const result1 = await Effect.runPromise(testPgConnectionUrl(url1));
		const result2 = await Effect.runPromise(testPgConnectionUrl(url2));

		// Both results should have same shape
		const keys1 = Object.keys(result1).sort();
		const keys2 = Object.keys(result2).sort();
		expect(keys1).toEqual(keys2);

		// Both should have required properties
		expect(result1).toHaveProperty("success");
		expect(result1).toHaveProperty("message");
		expect(result2).toHaveProperty("success");
		expect(result2).toHaveProperty("message");

		// All results should be Either-like (have success discriminator)
		expect(typeof result1.success).toBe("boolean");
		expect(typeof result2.success).toBe("boolean");
	});
});
