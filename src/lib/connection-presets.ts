import { DatabaseDialect } from "#src/db/dialect.ts";
import type { SslMode } from "#src/lib/connection-security.ts";

/**
 * Tier-0 connection presets: presentation-layer defaults for hosted/compatible
 * providers that ride an existing dialect path. A preset never changes the
 * persisted `dialect` (postgres stays `postgres` for introspection dispatch) —
 * it only seeds port / SSL defaults in the connection form.
 */
export type ConnectionPresetId =
  | "cockroachdb"
  | "neon"
  | "supabase"
  | "timescale"
  | "yugabyte"
  | "mariadb";

export interface ConnectionPreset {
  id: ConnectionPresetId;
  /** UI display name in the form select. */
  label: string;
  /** The existing dialect whose driver/introspection path this preset rides. */
  dialect: DatabaseDialect.Postgres | DatabaseDialect.MySQL;
  defaultPort: number;
  /** SSL default applied on preset selection (`null` leaves SSL untouched). */
  defaultSslMode: SslMode | null;
  hint?: string;
}

export const CONNECTION_PRESETS: readonly ConnectionPreset[] = [
  {
    id: "cockroachdb",
    label: "CockroachDB",
    dialect: DatabaseDialect.Postgres,
    defaultPort: 26257,
    defaultSslMode: null,
    hint: "Postgres-compatible; connects through the Postgres driver.",
  },
  {
    id: "neon",
    label: "Neon",
    dialect: DatabaseDialect.Postgres,
    defaultPort: 5432,
    defaultSslMode: "require",
    hint: "Serverless Postgres — SSL required by Neon endpoints.",
  },
  {
    id: "supabase",
    label: "Supabase",
    dialect: DatabaseDialect.Postgres,
    defaultPort: 5432,
    defaultSslMode: "require",
    hint: "Use the connection pooler or direct host from Supabase settings.",
  },
  {
    id: "timescale",
    label: "TimescaleDB",
    dialect: DatabaseDialect.Postgres,
    defaultPort: 5432,
    defaultSslMode: null,
    hint: "Postgres extension — plain Postgres driver.",
  },
  {
    id: "yugabyte",
    label: "YugabyteDB",
    dialect: DatabaseDialect.Postgres,
    defaultPort: 5433,
    defaultSslMode: null,
    hint: "YSQL API via the Postgres driver (default YSQL port 5433).",
  },
  {
    id: "mariadb",
    label: "MariaDB",
    dialect: DatabaseDialect.MySQL,
    defaultPort: 3306,
    defaultSslMode: null,
    hint: "MySQL-wire-compatible; connects through the MySQL driver.",
  },
];

export const getPresetById = (
  id: ConnectionPresetId,
): ConnectionPreset | undefined => CONNECTION_PRESETS.find((preset) => preset.id === id);

/** Select options for a preset dropdown, grouped under their base type. */
export const getPresetOptions = (): ReadonlyArray<{
  label: string;
  value: ConnectionPresetId;
}> => CONNECTION_PRESETS.map((preset) => ({ label: preset.label, value: preset.id }));

/** Form-level effect of picking a preset: which fields it seeds. */
export interface PresetDefaults {
  dialect: ConnectionPreset["dialect"];
  port: number;
  sslMode: SslMode | null;
}

export const getPresetDefaults = (id: ConnectionPresetId): PresetDefaults | undefined => {
  const preset = getPresetById(id);
  if (!preset) return undefined;
  return { dialect: preset.dialect, port: preset.defaultPort, sslMode: preset.defaultSslMode };
};
