/**
 * Pure command-palette command list builder.
 * UI wires `id` → page callbacks; this module stays framework-free.
 */

export const COMMAND_PALETTE_IDS = {
  openCustomSql: "open-custom-sql",
  toggleZen: "toggle-zen",
  openAi: "open-ai",
  openFavorites: "open-favorites",
  openHistory: "open-history",
  explain: "explain-query",
  formatSql: "format-sql",
  showIndexes: "show-indexes",
  showForeignKeys: "show-foreign-keys",
  openSchemaExplorer: "open-schema-explorer",
} as const;

export type CommandPaletteStaticId = (typeof COMMAND_PALETTE_IDS)[keyof typeof COMMAND_PALETTE_IDS];

export type CommandPaletteGroup =
  | "Actions"
  | "Query"
  | "Navigation"
  | "Tables"
  | "Schemas"
  | "Connections";

export interface CommandPaletteCommand {
  id: string;
  label: string;
  keywords: string[];
  group: CommandPaletteGroup;
}

export interface CommandPaletteTableRef {
  name: string;
  /** SQLite/LibSQL introspection omits this column entirely. */
  schema?: string | null;
}

export interface CommandPaletteConnectionRef {
  name: string;
}

export interface CommandPaletteContext {
  tables?: ReadonlyArray<CommandPaletteTableRef>;
  schemas?: ReadonlyArray<string>;
  connections?: ReadonlyArray<CommandPaletteConnectionRef>;
  currentTable?: string | null;
  currentSchema?: string | null;
  currentConnectionName?: string | null;
  zenMode?: boolean;
}

export const switchTableCommandId = (schema: string, table: string): string =>
  `switch-table:${schema}.${table}`;

export const switchSchemaCommandId = (schema: string): string => `switch-schema:${schema}`;

export const switchConnectionCommandId = (name: string): string => `switch-connection:${name}`;

export const parseSwitchTableCommandId = (id: string): { schema: string; table: string } | null => {
  if (!id.startsWith("switch-table:")) return null;
  const rest = id.slice("switch-table:".length);
  const dot = rest.indexOf(".");
  // Leading dot = schema-less (SQLite/LibSQL) table; trailing dot is malformed.
  if (dot === -1 || dot === rest.length - 1) return null;
  return { schema: rest.slice(0, dot), table: rest.slice(dot + 1) };
};

export const parseSwitchSchemaCommandId = (id: string): string | null => {
  if (!id.startsWith("switch-schema:")) return null;
  const schema = id.slice("switch-schema:".length);
  return schema || null;
};

export const parseSwitchConnectionCommandId = (id: string): string | null => {
  if (!id.startsWith("switch-connection:")) return null;
  const name = id.slice("switch-connection:".length);
  return name || null;
};

const staticCommands = (ctx: CommandPaletteContext): CommandPaletteCommand[] => {
  const zenLabel = ctx.zenMode ? "Exit zen mode" : "Enter zen mode";

  return [
    {
      id: COMMAND_PALETTE_IDS.openCustomSql,
      label: "New custom SQL query",
      keywords: ["sql", "query", "editor", "new", "custom"],
      group: "Actions",
    },
    {
      id: COMMAND_PALETTE_IDS.toggleZen,
      label: zenLabel,
      keywords: ["zen", "focus", "distraction", "chrome", "minimal"],
      group: "Actions",
    },
    {
      id: COMMAND_PALETTE_IDS.openAi,
      label: "Open AI assistant",
      keywords: ["ai", "assistant", "llm", "chat", "generate"],
      group: "Actions",
    },
    {
      id: COMMAND_PALETTE_IDS.openFavorites,
      label: "Open favorites",
      keywords: ["favorites", "saved", "star", "bookmark"],
      group: "Query",
    },
    {
      id: COMMAND_PALETTE_IDS.openHistory,
      label: "Open query history",
      keywords: ["history", "logger", "past", "queries"],
      group: "Query",
    },
    {
      id: COMMAND_PALETTE_IDS.explain,
      label: "Explain query plan",
      keywords: ["explain", "plan", "analyze", "performance", "query plan"],
      group: "Query",
    },
    {
      id: COMMAND_PALETTE_IDS.formatSql,
      label: "Format SQL",
      keywords: ["format", "prettier", "indent", "sql"],
      group: "Query",
    },
    {
      id: COMMAND_PALETTE_IDS.showIndexes,
      label: "Show table indexes",
      keywords: ["indexes", "index", "structure", "unique", "primary"],
      group: "Navigation",
    },
    {
      id: COMMAND_PALETTE_IDS.showForeignKeys,
      label: "Show foreign keys",
      keywords: ["foreign", "keys", "fk", "relations", "relationships"],
      group: "Navigation",
    },
    {
      id: COMMAND_PALETTE_IDS.openSchemaExplorer,
      label: "Open schema explorer",
      keywords: ["schema", "explorer", "tables", "browse"],
      group: "Navigation",
    },
  ];
};

/**
 * Build the command palette list from page context.
 * Dynamic switch-* entries omit the current table/schema/connection.
 */
export function buildCommandPaletteCommands(
  ctx: CommandPaletteContext = {},
): CommandPaletteCommand[] {
  const commands: CommandPaletteCommand[] = [...staticCommands(ctx)];

  const currentSchema = ctx.currentSchema ?? null;
  const currentTable = ctx.currentTable ?? null;
  const currentConnectionName = ctx.currentConnectionName ?? null;

  for (const table of ctx.tables ?? []) {
    if (table.schema === currentSchema && table.name === currentTable) continue;
    // SQLite/LibSQL introspection returns rows without a schema column.
    // cmdk crashes on non-string keywords, so schema must never reach the
    // command as undefined/null — omit it from label/keywords instead.
    const schema = table.schema ?? "";
    commands.push({
      id: switchTableCommandId(schema, table.name),
      label: schema ? `Switch to ${schema}.${table.name}` : `Switch to ${table.name}`,
      keywords: [
        "table",
        "switch",
        table.name,
        ...(schema ? [schema, `${schema}.${table.name}`] : []),
      ],
      group: "Tables",
    });
  }

  for (const schema of ctx.schemas ?? []) {
    if (schema === currentSchema) continue;
    commands.push({
      id: switchSchemaCommandId(schema),
      label: `Switch schema to ${schema}`,
      keywords: ["schema", "database", "switch", String(schema)],
      group: "Schemas",
    });
  }

  for (const connection of ctx.connections ?? []) {
    if (connection.name === currentConnectionName) continue;
    commands.push({
      id: switchConnectionCommandId(connection.name),
      label: `Switch connection to ${connection.name}`,
      keywords: ["connection", "switch", "database", connection.name],
      group: "Connections",
    });
  }

  return commands;
}
