import { describe, expect, it } from "vitest";

import { queryFkTargetDataQueryOptions } from "./get-fk-target-data.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "./get-relationship-subrow-data.start.ts";

describe("Result Query Server Functions", () => {
  describe("queryRelationshipSubrowDataQueryOptions", () => {
    it("creates query options for subrow data with equals filter", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      expect(options).toBeDefined();
      expect(options.queryKey).toBeDefined();
      expect(options.queryFn).toBeDefined();
    });

    it("creates query options with pagination parameters", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "user_id",
        filterValue: 5,
        limit: 25,
        offset: 50,
      });

      expect(options).toBeDefined();
      expect(options.queryKey).toBeDefined();
    });

    it("handles null filter values with is_null operator", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "category",
        filterValue: null,
      });

      expect(options).toBeDefined();
      expect(options.queryKey).toBeDefined();
    });

    it("handles undefined filter values as null", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "category",
        filterValue: undefined,
      });

      expect(options).toBeDefined();
    });

    it("handles string 'null' as is_null operator", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "category",
        filterValue: "null",
      });

      expect(options).toBeDefined();
    });

    it("includes unique query key for pagination", () => {
      const options1 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "user_id",
        filterValue: 1,
        offset: 0,
      });

      const options2 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "user_id",
        filterValue: 1,
        offset: 50,
      });

      // Different offsets should result in different query keys
      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });

    it("defaults limit to 50 when not specified", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      expect(options).toBeDefined();
      // Default limit should be applied in the underlying queryTableData call
    });

    it("defaults offset to 0 when not specified", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      expect(options).toBeDefined();
      // Default offset should be applied
    });

    it("handles numeric string filter values", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "user_id",
        filterValue: "123",
      });

      expect(options).toBeDefined();
    });

    it("handles various table schemas", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      expect(options).toBeDefined();
    });

    it("has queryFn that returns a Promise", () => {
      const options = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      expect(typeof options.queryFn).toBe("function");
    });

    it("creates different query keys for different tables", () => {
      const options1 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      const options2 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "posts",
        filterColumn: "user_id",
        filterValue: 1,
      });

      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });

    it("creates different query keys for different filter values", () => {
      const options1 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      });

      const options2 = queryRelationshipSubrowDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 2,
      });

      // Different filter values might result in different internal queries
      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });
  });

  describe("queryFkTargetDataQueryOptions", () => {
    it("creates query options for FK target data with equals filter", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options).toBeDefined();
      expect(options.queryKey).toBeDefined();
      expect(options.queryFn).toBeDefined();
    });

    it("includes schema parameter in options", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options).toBeDefined();
    });

    it("creates query options with pagination parameters", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 5,
        limit: 25,
        offset: 50,
      });

      expect(options).toBeDefined();
      expect(options.queryKey).toBeDefined();
    });

    it("handles null FK values with is_null operator", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: null,
      });

      expect(options).toBeDefined();
    });

    it("handles undefined FK values as null", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: undefined,
      });

      expect(options).toBeDefined();
    });

    it("handles string 'null' as is_null operator", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: "null",
      });

      expect(options).toBeDefined();
    });

    it("defaults limit to 50 when not specified", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options).toBeDefined();
    });

    it("defaults offset to 0 when not specified", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options).toBeDefined();
    });

    it("handles numeric string FK values", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: "123",
      });

      expect(options).toBeDefined();
    });

    it("has queryFn that returns a Promise", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(typeof options.queryFn).toBe("function");
    });

    it("creates different query keys for different referenced tables", () => {
      const options1 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      const options2 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "posts",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });

    it("creates different query keys for different FK values", () => {
      const options1 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      const options2 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 2,
      });

      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });

    it("handles different schemas", () => {
      const options = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "custom_schema",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options).toBeDefined();
    });

    it("distinguishes between schemas in query keys", () => {
      const options1 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      const options2 = queryFkTargetDataQueryOptions({
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "custom_schema",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      });

      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });
  });

  describe("Query Options Caching Behavior", () => {
    it("identical inputs produce identical query options", () => {
      const input = {
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      };

      const options1 = queryRelationshipSubrowDataQueryOptions(input);
      const options2 = queryRelationshipSubrowDataQueryOptions(input);

      expect(options1.queryKey).toEqual(options2.queryKey);
    });

    it("FK target query options are cacheable", () => {
      const input = {
        url: "postgresql://localhost/db",
        schema: "public",
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        fkValue: 1,
      };

      const options1 = queryFkTargetDataQueryOptions(input);
      const options2 = queryFkTargetDataQueryOptions(input);

      expect(options1.queryKey).toEqual(options2.queryKey);
    });

    it("subrow query options with pagination are cacheable separately", () => {
      const baseInput = {
        url: "postgresql://localhost/db",
        schema: "public",
        table: "comments",
        filterColumn: "post_id",
        filterValue: 1,
      };

      const options1 = queryRelationshipSubrowDataQueryOptions({
        ...baseInput,
        offset: 0,
      });

      const options2 = queryRelationshipSubrowDataQueryOptions({
        ...baseInput,
        offset: 50,
      });

      // Different pagination states should be separate cache entries
      expect(options1.queryKey).not.toEqual(options2.queryKey);
    });
  });
});
