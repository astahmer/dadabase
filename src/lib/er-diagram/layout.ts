export interface ErTableInput {
  /** Unique table identifier, e.g. `"public.users"`. */
  id: string;
  /** Number of columns, used to size the node's height. */
  columnCount: number;
}

export interface ErEdgeInput {
  /** Child table holding the foreign key. */
  fromId: string;
  /** Parent table referenced by the foreign key. */
  toId: string;
}

export interface ErNodeLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ErEdgeLayout {
  fromId: string;
  toId: string;
}

export interface ErDiagramLayoutInput {
  tables: readonly ErTableInput[];
  edges: readonly ErEdgeInput[];
}

export interface ErDiagramLayout {
  nodes: ErNodeLayout[];
  edges: ErEdgeLayout[];
}

const NODE_WIDTH = 220;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 24;
const MIN_ROWS_SHOWN = 1;
const LAYER_GAP_X = 80;
const NODE_GAP_Y = 40;
const MARGIN = 40;

function nodeHeight(columnCount: number): number {
  return HEADER_HEIGHT + Math.max(columnCount, MIN_ROWS_SHOWN) * ROW_HEIGHT;
}

/**
 * Assigns each table a layer (column) equal to the longest chain of outgoing
 * (child -> parent) edges reachable from it, so parent tables land to the left
 * and their dependents cascade to the right. Cycles are broken deterministically
 * by processing tables in input order and capping recursion via a visiting set.
 */
function computeLayers(
  tables: readonly ErTableInput[],
  edges: readonly ErEdgeInput[],
): Map<string, number> {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.fromId) ?? [];
    list.push(edge.toId);
    outgoing.set(edge.fromId, list);
  }

  const layers = new Map<string, number>();

  const resolve = (id: string, visiting: Set<string>): number => {
    const cached = layers.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard: treat as a root at this point

    visiting.add(id);
    let layer = 0;
    for (const parentId of outgoing.get(id) ?? []) {
      layer = Math.max(layer, resolve(parentId, visiting) + 1);
    }
    visiting.delete(id);

    layers.set(id, layer);
    return layer;
  };

  for (const table of tables) {
    resolve(table.id, new Set());
  }

  return layers;
}

/**
 * Builds a deterministic, simple layered layout for an ER diagram: tables are
 * grouped into layers by foreign-key depth (parents left, dependents right),
 * then stacked top-to-bottom within each layer in input order.
 */
export function buildErDiagramLayout(input: ErDiagramLayoutInput): ErDiagramLayout {
  const { tables, edges } = input;
  const layers = computeLayers(tables, edges);

  const tablesByLayer = new Map<number, ErTableInput[]>();
  for (const table of tables) {
    const layer = layers.get(table.id) ?? 0;
    const list = tablesByLayer.get(layer) ?? [];
    list.push(table);
    tablesByLayer.set(layer, list);
  }

  const nodes: ErNodeLayout[] = [];
  const sortedLayerIndices = [...tablesByLayer.keys()].toSorted((a, b) => a - b);
  for (const layerIndex of sortedLayerIndices) {
    const layerTables = tablesByLayer.get(layerIndex)!;
    const x = MARGIN + layerIndex * (NODE_WIDTH + LAYER_GAP_X);
    let y = MARGIN;
    for (const table of layerTables) {
      const h = nodeHeight(table.columnCount);
      nodes.push({ id: table.id, x, y, w: NODE_WIDTH, h });
      y += h + NODE_GAP_Y;
    }
  }

  const nodesById = new Set(nodes.map((n) => n.id));
  const outEdges: ErEdgeLayout[] = edges
    .filter((e) => nodesById.has(e.fromId) && nodesById.has(e.toId))
    .map((e) => ({ fromId: e.fromId, toId: e.toId }));

  return { nodes, edges: outEdges };
}
