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
