import type { DatabaseConnectionAdapterType } from "./connection-adapter.ts";
import {
	findColumnReferences,
	findColumnReferencesWithCounts,
	getAllTablesColumns,
	getAvailableDatabases,
	getAvailableSchemas,
	getAvailableTables,
	getRelationshipCardinality,
	getRelationshipsCounts,
	getTableColumns,
	getTableForeignKeys,
	getTableIndexes,
	getTableRelationships,
	queryTableRows,
} from "./introspection.ts";

export const createPostgresConnectionAdapter =
	(): DatabaseConnectionAdapterType => ({
		dialect: "postgres",
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
