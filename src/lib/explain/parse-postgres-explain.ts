export interface PostgresExplainNode {
  name: string;
  level: number;
  cost: string;
  rows: string;
  actualRows: string;
  time: string;
  actualTime: number;
  details: Record<string, string>;
}

export interface PostgresExplainResult {
  nodes: PostgresExplainNode[];
  totals: { planningTime: string; executionTime: string };
}

/**
 * Parse PostgreSQL `EXPLAIN ANALYZE` text output into structured nodes.
 * Heuristic, text-based parser (not the JSON/XML explain formats).
 */
export function parsePostgresExplain(output: string): PostgresExplainResult {
  const lines = output.split("\n");
  const nodes: PostgresExplainNode[] = [];
  let planningTime = "";
  let executionTime = "";

  for (const line of lines) {
    if (line.includes("Planning Time:")) {
      planningTime = line.split(":")[1]?.trim() || "";
    }
    if (line.includes("Execution Time:")) {
      executionTime = line.split(":")[1]?.trim() || "";
    }

    if (!line.trim() || line.includes("Planning Time") || line.includes("Execution Time")) {
      continue;
    }

    const indentMatch = line.match(/^(\s*)/);
    const level = indentMatch ? indentMatch[1].length : 0;

    const costMatch = line.match(/cost=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)/);
    const actualMatch = line.match(/actual time=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)/);
    const nodeNameMatch = line.match(/^\s*(?:->)?\s*(.+?)\s*(?:\(|$)/);

    if (nodeNameMatch) {
      const actualTimeValue = actualMatch ? actualMatch[2] : null;
      const actualTimeMs = actualTimeValue ? parseFloat(actualTimeValue) : NaN;

      nodes.push({
        name: nodeNameMatch[1].trim(),
        level,
        cost: costMatch ? `${costMatch[1]} - ${costMatch[2]}` : "N/A",
        rows: costMatch ? costMatch[3] : "N/A",
        actualRows: actualMatch ? actualMatch[3] : "N/A",
        time: actualMatch ? `${actualMatch[1]} - ${actualMatch[2]}` : "N/A",
        actualTime: actualTimeMs,
        details: {
          rawLine: line.trim(),
        },
      });
    }
  }

  return {
    nodes,
    totals: {
      planningTime,
      executionTime,
    },
  };
}
