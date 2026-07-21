import type { SchemaDiffColumn, SchemaDiffOp, TableStructure } from "./types.ts";

function tableKey(schema: string, table: string): string {
  return `${schema}::${table}`;
}

function columnSignature(columns: readonly SchemaDiffColumn[]): string {
  return columns
    .map((c) => `${c.name}|${c.dataType}|${c.nullable}`)
    .sort()
    .join(",");
}

function diffColumns(
  schema: string,
  table: string,
  before: readonly SchemaDiffColumn[],
  after: readonly SchemaDiffColumn[],
): SchemaDiffOp[] {
  const ops: SchemaDiffOp[] = [];
  const beforeByName = new Map(before.map((c) => [c.name, c]));
  const afterByName = new Map(after.map((c) => [c.name, c]));

  for (const column of after) {
    if (!beforeByName.has(column.name)) {
      ops.push({ kind: "add-column", schema, table, column });
    }
  }

  for (const column of before) {
    if (!afterByName.has(column.name)) {
      ops.push({ kind: "drop-column", schema, table, column: column.name });
    }
  }

  for (const column of after) {
    const prev = beforeByName.get(column.name);
    if (!prev) continue;
    const prevDefault = prev.defaultValue ?? null;
    const nextDefault = column.defaultValue ?? null;
    if (
      prev.dataType !== column.dataType ||
      prev.nullable !== column.nullable ||
      prevDefault !== nextDefault
    ) {
      ops.push({
        kind: "alter-column",
        schema,
        table,
        column: column.name,
        from: { dataType: prev.dataType, nullable: prev.nullable, defaultValue: prevDefault },
        to: { dataType: column.dataType, nullable: column.nullable, defaultValue: nextDefault },
      });
    }
  }

  return ops;
}

/**
 * Diffs two snapshots of table structures and emits an ordered list of migration ops.
 * Table renames are detected heuristically: a dropped table and an added table in the
 * same schema are treated as a rename when they share an identical column signature
 * (name + data type + nullability) and the match is unambiguous.
 */
export function diffTableStructures(
  before: readonly TableStructure[],
  after: readonly TableStructure[],
): SchemaDiffOp[] {
  const beforeByKey = new Map(before.map((t) => [tableKey(t.schema, t.table), t]));
  const afterByKey = new Map(after.map((t) => [tableKey(t.schema, t.table), t]));

  const droppedOnly = new Map([...beforeByKey].filter(([key]) => !afterByKey.has(key)));
  const addedOnly = new Map([...afterByKey].filter(([key]) => !beforeByKey.has(key)));

  const renameOps: SchemaDiffOp[] = [];
  const signatureToDropped = new Map<string, TableStructure[]>();
  for (const table of droppedOnly.values()) {
    const sig = `${table.schema}::${columnSignature(table.columns)}`;
    const list = signatureToDropped.get(sig) ?? [];
    list.push(table);
    signatureToDropped.set(sig, list);
  }

  const consumedDropped = new Set<string>();
  const consumedAdded = new Set<string>();
  for (const table of addedOnly.values()) {
    const sig = `${table.schema}::${columnSignature(table.columns)}`;
    const candidates = (signatureToDropped.get(sig) ?? []).filter(
      (t) => !consumedDropped.has(tableKey(t.schema, t.table)),
    );
    if (candidates.length !== 1) continue;
    const from = candidates[0]!;
    renameOps.push({
      kind: "rename-table",
      schema: table.schema,
      fromTable: from.table,
      toTable: table.table,
    });
    consumedDropped.add(tableKey(from.schema, from.table));
    consumedAdded.add(tableKey(table.schema, table.table));
  }

  const addOps: SchemaDiffOp[] = [...addedOnly.values()]
    .filter((t) => !consumedAdded.has(tableKey(t.schema, t.table)))
    .map((t) => ({
      kind: "add-table" as const,
      schema: t.schema,
      table: t.table,
      columns: t.columns,
    }));

  const dropOps: SchemaDiffOp[] = [...droppedOnly.values()]
    .filter((t) => !consumedDropped.has(tableKey(t.schema, t.table)))
    .map((t) => ({ kind: "drop-table" as const, schema: t.schema, table: t.table }));

  const columnOps: SchemaDiffOp[] = [];
  for (const [key, beforeTable] of beforeByKey) {
    const afterTable = afterByKey.get(key);
    if (!afterTable) continue;
    columnOps.push(
      ...diffColumns(
        beforeTable.schema,
        beforeTable.table,
        beforeTable.columns,
        afterTable.columns,
      ),
    );
  }

  return [...addOps, ...renameOps, ...columnOps, ...dropOps];
}
