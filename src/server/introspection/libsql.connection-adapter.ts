import type { ConnectionAdapter } from "./connection-adapter.ts";
import {
	getAvailableDatabases,
	getAvailableSchemas,
	getAvailableTables,
	getTableForeignKeys,
	getTableIndexes,
	getAllTablesColumns,
	getTableRelationships,
	findColumnReferences,
	findColumnReferencesWithCounts,
	getRelationshipCardinality,
	getRelationshipsCounts,
	queryTableRows,
	getTableColumns,
} from "./introspection.ts";

export const createPostgresConnectionAdapter = (): ConnectionAdapter => ({
	dialect: "sqlite",
	getAvailableDatabases,
	getAvailableSchemas,
	getAvailableTables,
	getTableColumns,
	getTableForeignKeys,
	getTableIndexes,
	getAllTablesColumns,
	getTableRelationships,
	findColumnReferences,
	findColumnReferencesWithCounts,
	getRelationshipCardinality,
	getRelationshipsCounts,
	queryTableRows,
});
