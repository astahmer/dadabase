import { describe, expect, it, vi } from "vitest";

import {
  buildPerStatementViewZoneLayouts,
  buildSqlEditorViewZoneLayout,
  createSqlEditorViewZoneDom,
  PER_STATEMENT_VIEW_ZONE_ACTIONS,
  SQL_EDITOR_VIEW_ZONE_ACTIONS,
} from "./sql-editor-view-zones.ts";

describe("buildSqlEditorViewZoneLayout", () => {
  it("places a 28px strip above the first line with default actions", () => {
    expect(buildSqlEditorViewZoneLayout()).toEqual({
      afterLineNumber: 0,
      heightInPx: 28,
      actions: SQL_EDITOR_VIEW_ZONE_ACTIONS,
    });
  });

  it("accepts a custom action list", () => {
    const actions = [{ id: "run" as const, label: "Go" }];
    expect(buildSqlEditorViewZoneLayout(actions).actions).toEqual(actions);
  });
});

describe("buildPerStatementViewZoneLayouts", () => {
  it("places one zone per statement, anchored just above its start line", () => {
    const statements = [
      { sql: "SELECT 1", startLine: 1 },
      { sql: "SELECT 2", startLine: 3 },
    ];
    expect(buildPerStatementViewZoneLayouts(statements)).toEqual([
      {
        afterLineNumber: 0,
        heightInPx: 24,
        actions: PER_STATEMENT_VIEW_ZONE_ACTIONS,
        statementIndex: 0,
        sql: "SELECT 1",
      },
      {
        afterLineNumber: 2,
        heightInPx: 24,
        actions: PER_STATEMENT_VIEW_ZONE_ACTIONS,
        statementIndex: 1,
        sql: "SELECT 2",
      },
    ]);
  });

  it("includes Run and Explain actions by default", () => {
    const ids = PER_STATEMENT_VIEW_ZONE_ACTIONS.map((a) => a.id);
    expect(ids).toContain("run");
    expect(ids).toContain("explain");
  });

  it("never places a zone before line 0", () => {
    const [layout] = buildPerStatementViewZoneLayouts([{ sql: "x", startLine: 1 }]);
    expect(layout?.afterLineNumber).toBe(0);
  });

  it("accepts a custom action list", () => {
    const actions = [{ id: "run" as const, label: "Go" }];
    const [layout] = buildPerStatementViewZoneLayouts([{ sql: "x", startLine: 1 }], actions);
    expect(layout?.actions).toEqual(actions);
  });

  it("returns an empty array for no statements", () => {
    expect(buildPerStatementViewZoneLayouts([])).toEqual([]);
  });
});

describe("createSqlEditorViewZoneDom", () => {
  it("renders a button per action and invokes onAction", () => {
    const onAction = vi.fn();
    const created: Array<{
      tag: string;
      textContent: string;
      dataset: Record<string, string>;
      listeners: Array<
        (event: { preventDefault: () => void; stopPropagation: () => void }) => void
      >;
      children: unknown[];
    }> = [];

    const doc = {
      createElement: (tag: string) => {
        const node = {
          tag,
          className: "",
          style: {} as Record<string, string>,
          textContent: "",
          type: "",
          dataset: {} as Record<string, string>,
          listeners: [] as Array<
            (event: { preventDefault: () => void; stopPropagation: () => void }) => void
          >,
          children: [] as unknown[],
          addEventListener: (
            _event: string,
            handler: (event: { preventDefault: () => void; stopPropagation: () => void }) => void,
          ) => {
            node.listeners.push(handler);
          },
          appendChild: (child: unknown) => {
            node.children.push(child);
            return child;
          },
        };
        created.push(node);
        return node;
      },
    } as unknown as Document;

    const root = createSqlEditorViewZoneDom(
      [
        { id: "run", label: "Run" },
        { id: "copy", label: "Copy" },
      ],
      onAction,
      doc,
    ) as unknown as { children: typeof created };

    expect(root.children).toHaveLength(2);
    expect(created.filter((n) => n.tag === "button")).toHaveLength(2);
    expect(created[1]?.dataset.action).toBe("run");
    expect(created[1]?.textContent).toBe("Run");
    expect(created[2]?.textContent).toBe("Copy");

    created[1]?.listeners[0]?.({
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    });
    expect(onAction).toHaveBeenCalledWith("run");
  });
});
