import { boolean, integer, pgSchema, pgTable, text } from "drizzle-orm/pg-core";

export const pg_catalog = pgSchema("pg_catalog");

export const pg_namespace = pg_catalog.table("pg_namespace", {
	oid: integer().primaryKey(),
	nspname: text().notNull(),
	nspowner: integer().notNull(),
	nspacl: text(),
});

export const pg_type = pgTable("pg_type", {
	oid: integer().primaryKey(),
	typname: text().notNull(),
	typnamespace: integer().notNull(),
	typowner: integer().notNull(),
	typlen: integer().notNull(),
	typbyval: boolean().notNull(),
	typtype: text().notNull(),
	typcategory: text().notNull(),
	typispreferred: boolean().notNull(),
	typisdefined: boolean().notNull(),
	typdelim: text().notNull(),
	typrelid: integer().notNull(),
	typsubscript: text().notNull(),
	typelem: integer().notNull(),
	typarray: integer().notNull(),
	typinput: text().notNull(),
	typoutput: text().notNull(),
	typreceive: text().notNull(),
	typsend: text().notNull(),
	typmodin: text().notNull(),
	typmodout: text().notNull(),
	typanalyze: text().notNull(),
	typalign: text().notNull(),
	typstorage: text().notNull(),
	typnotnull: boolean().notNull(),
	typbasetype: integer().notNull(),
	typtypmod: integer().notNull(),
	typndims: integer().notNull(),
	typcollation: integer().notNull(),
	typdefaultbin: text(),
	typdefault: text(),
	typacl: text(),
});

export const pg_enum = pgTable("pg_enum", {
	oid: integer().primaryKey(),
	enumtypid: integer().notNull(),
	enumsortorder: integer().notNull(),
	enumlabel: text().notNull(),
});

[
	{
		column_name: "oid",
		is_nullable: "NO",
		data_type: "oid",
	},
	{
		column_name: "datname",
		is_nullable: "NO",
		data_type: "name",
	},
	{
		column_name: "datdba",
		is_nullable: "NO",
		data_type: "oid",
	},
	{
		column_name: "encoding",
		is_nullable: "NO",
		data_type: "integer",
	},
	{
		column_name: "datlocprovider",
		is_nullable: "NO",
		data_type: '"char"',
	},
	{
		column_name: "datistemplate",
		is_nullable: "NO",
		data_type: "boolean",
	},
	{
		column_name: "datallowconn",
		is_nullable: "NO",
		data_type: "boolean",
	},
	{
		column_name: "dathasloginevt",
		is_nullable: "NO",
		data_type: "boolean",
	},
	{
		column_name: "datconnlimit",
		is_nullable: "NO",
		data_type: "integer",
	},
	{
		column_name: "datfrozenxid",
		is_nullable: "NO",
		data_type: "xid",
	},
	{
		column_name: "datminmxid",
		is_nullable: "NO",
		data_type: "xid",
	},
	{
		column_name: "dattablespace",
		is_nullable: "NO",
		data_type: "oid",
	},
	{
		column_name: "datcollate",
		is_nullable: "NO",
		data_type: "text",
	},
	{
		column_name: "datctype",
		is_nullable: "NO",
		data_type: "text",
	},
	{
		column_name: "datlocale",
		is_nullable: "YES",
		data_type: "text",
	},
	{
		column_name: "daticurules",
		is_nullable: "YES",
		data_type: "text",
	},
	{
		column_name: "datcollversion",
		is_nullable: "YES",
		data_type: "text",
	},
	{
		column_name: "datacl",
		is_nullable: "YES",
		data_type: "ARRAY",
	},
];

export const pg_database = pgTable("pg_database", {
	oid: integer().primaryKey(),
	datname: text().notNull(),
	datdba: integer().notNull(),
	encoding: text().notNull(),
	datlocprovider: text().notNull(),
	datistemplate: boolean().notNull(),
	datallowconn: boolean().notNull(),
	dathasloginevt: boolean().notNull(),
	datconnlimit: integer().notNull(),
	datfrozenxid: text().notNull(),
	datminmxid: text().notNull(),
	dattablespace: integer().notNull(),
	datcollate: text().notNull(),
	datctype: text().notNull(),
	datlocale: text(),
	daticurules: text(),
	datcollversion: text(),
	datacl: text(),
});
