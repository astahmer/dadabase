/**
 * Audit K6: leading-slash composer commands (`/clear`, `/schema`, `/tools`).
 * Parsed before a draft reaches the model; unknown slash-words surface a hint
 * toast instead of silently going to the provider as literal text.
 */
export type ComposerCommandName = "clear" | "schema" | "tools";

export interface ComposerCommand {
  name: ComposerCommandName;
}

export type ComposerCommandParse =
  | { kind: "command"; command: ComposerCommand }
  | { kind: "unknown" }
  | { kind: "none" };

const COMMAND_NAMES: readonly ComposerCommandName[] = ["clear", "schema", "tools"];

/** Pure: `"/schema"` → command; `"/nope"` → unknown; `"hello"` → none. */
export const parseComposerCommand = (draft: string): ComposerCommandParse => {
  const trimmed = draft.trim();
  if (!trimmed.startsWith("/")) return { kind: "none" };
  const word = trimmed.slice(1).split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  if (!(COMMAND_NAMES as readonly string[]).includes(word)) return { kind: "unknown" };
  return { kind: "command", command: { name: word as ComposerCommandName } };
};

export interface RunComposerCommandInput {
  command: ComposerCommand;
  onClear: () => void;
  /** `/schema` and `/tools` both open the settings surface; the panel the
   * user wants is announced either way. */
  onOpenSchemaPanel: () => void;
  announce: (message: string) => void;
}

export const runComposerCommand = (input: RunComposerCommandInput): void => {
  switch (input.command.name) {
    case "clear": {
      input.onClear();
      input.announce("Started a new chat.");
      return;
    }
    case "schema": {
      input.onOpenSchemaPanel();
      input.announce("Opened schema settings.");
      return;
    }
    case "tools": {
      input.onOpenSchemaPanel();
      input.announce("Opened tool settings.");
      return;
    }
  }
};

/** The exact copy shown for an unrecognized slash-word (audit K6 hint path). */
export const UNKNOWN_COMMAND_HINT = "Unknown command. Available: /clear, /schema, /tools.";
