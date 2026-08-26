import { describe, expect, it } from "vitest";

import {
  parseComposerCommand,
  runComposerCommand,
  UNKNOWN_COMMAND_HINT,
} from "./chat-composer-commands.ts";

describe("parseComposerCommand", () => {
  it("parses known commands case-insensitively", () => {
    expect(parseComposerCommand("/clear")).toEqual({ kind: "command", command: { name: "clear" } });
    expect(parseComposerCommand("  /Schema  ")).toEqual({
      kind: "command",
      command: { name: "schema" },
    });
    expect(parseComposerCommand("/TOOLS")).toEqual({
      kind: "command",
      command: { name: "tools" },
    });
  });

  it("treats plain text and unknown slash-words distinctly", () => {
    expect(parseComposerCommand("hello world")).toEqual({ kind: "none" });
    expect(parseComposerCommand("")).toEqual({ kind: "none" });
    expect(parseComposerCommand("/nope extra")).toEqual({ kind: "unknown" });
  });
});

describe("runComposerCommand", () => {
  it("routes clear to a new conversation", () => {
    const calls: string[] = [];
    runComposerCommand({
      command: { name: "clear" },
      onClear: () => calls.push("clear"),
      onOpenSchemaPanel: () => calls.push("panel"),
      announce: (m) => calls.push(m),
    });
    expect(calls).toEqual(["clear", "Started a new chat."]);
  });

  it("opens the settings surface for /schema and /tools", () => {
    const calls: string[] = [];
    const input = {
      onClear: () => calls.push("clear"),
      onOpenSchemaPanel: () => calls.push("panel"),
      announce: (m: string) => calls.push(m),
    };
    runComposerCommand({ command: { name: "schema" }, ...input });
    runComposerCommand({ command: { name: "tools" }, ...input });
    expect(calls).toEqual(["panel", "Opened schema settings.", "panel", "Opened tool settings."]);
  });

  it("exposes an actionable hint for unknown commands", () => {
    expect(UNKNOWN_COMMAND_HINT).toContain("/clear");
    expect(UNKNOWN_COMMAND_HINT).toContain("/schema");
    expect(UNKNOWN_COMMAND_HINT).toContain("/tools");
  });
});
