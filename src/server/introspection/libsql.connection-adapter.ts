import type { DatabaseConnectionAdapterType } from "./connection-adapter.ts";
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

export const createPostgresConnectionAdapter =
	(): DatabaseConnectionAdapterType => ({
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
