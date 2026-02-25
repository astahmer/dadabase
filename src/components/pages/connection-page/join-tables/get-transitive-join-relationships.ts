import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";

export type RelationshipSource = {
  sourceSchema: string;
  sourceTable: string;
  relationship: TableRelationship;
};

const tableId = (schema: string, table: string) => `${schema}.${table}`;

const getTargetTable = (relationship: TableRelationship): { schema: string; table: string } => {
  return relationship.type === "outgoing"
    ? {
        schema: relationship.referencedSchema,
        table: relationship.referencedTable,
      }
    : {
        schema: relationship.referencingSchema,
        table: relationship.referencingTable,
      };
};

/**
 * Given relationship lists for tables already in the join set (base + selected joins),
 * return the next possible join relationships (the frontier), excluding tables already selected.
 */
export const getTransitiveJoinRelationships = (input: {
  base: { schema: string; table: string };
  joined: Array<{ schema: string; table: string }>;
  relationshipsBySource: Map<string, TableRelationship[]>;
}): RelationshipSource[] => {
  const selected = new Set<string>([
    tableId(input.base.schema, input.base.table),
    ...input.joined.map((t) => tableId(t.schema, t.table)),
  ]);

  const sources = [input.base, ...input.joined].map((t) => ({
    ...t,
    id: tableId(t.schema, t.table),
  }));

  const out: RelationshipSource[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const relationships = input.relationshipsBySource.get(source.id) ?? [];
    for (const relationship of relationships) {
      const target = getTargetTable(relationship);
      const targetId = tableId(target.schema, target.table);
      if (selected.has(targetId)) continue;

      const key = `${source.id}|${relationship.type}|${relationship.constraintName}|${relationship.referencingSchema}.${relationship.referencingTable}.${relationship.referencingColumn}|${relationship.referencedSchema}.${relationship.referencedTable}.${relationship.referencedColumn}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        sourceSchema: source.schema,
        sourceTable: source.table,
        relationship,
      });
    }
  }

  return out;
};
