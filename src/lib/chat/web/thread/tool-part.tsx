"use client";

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useState, type ReactNode } from "react";

import { useToolRenderer } from "../contributions.tsx";
import { ToolResultContent } from "./tool-result-content.tsx";

export type MessagePartValue = {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
  [key: string]: unknown;
};

const ToolMessagePart = Schema.Struct({
  type: Schema.String,
  toolName: Schema.optional(Schema.String),
  input: Schema.optional(Schema.Unknown),
  args: Schema.optional(Schema.Unknown),
  argsText: Schema.optional(Schema.Unknown),
  output: Schema.optional(Schema.Unknown),
  result: Schema.optional(Schema.Unknown),
  state: Schema.optional(Schema.String),
  outcome: Schema.optional(Schema.String),
});
const ToolErrorOutput = Schema.Union([
  Schema.Struct({ type: Schema.Literal("error-text"), value: Schema.String }),
  Schema.Struct({ error: Schema.String }),
]);
const ToolWarningOutput = Schema.Struct({
  type: Schema.Literal("warning-text"),
  value: Schema.String,
});

export const ToolPart = ({
  part,
  isStreaming,
  renderToolResult,
  renderToolInput,
}: {
  part: MessagePartValue;
  isStreaming: boolean;
  renderToolResult?: (args: { toolName: string; result: unknown }) => ReactNode;
  /**
   * Replace the collapsed-by-default "Input" block. Apps use this to make
   * important inputs visible without interaction (audit C4: propose_sql's SQL
   * must be readable while the model is still streaming).
   */
  renderToolInput?: (args: { toolName: string; input: unknown }) => ReactNode;
}): ReactNode => {
  const toolPart = Schema.decodeUnknownOption(ToolMessagePart)(part);
  const type = Option.isSome(toolPart) ? toolPart.value.type : "";
  const isTool =
    type === "dynamic-tool" ||
    type === "tool-invocation" ||
    type === "tool-call" ||
    type.startsWith("tool-");
  const configuredToolName = Option.isSome(toolPart) ? toolPart.value.toolName : undefined;
  const toolName =
    configuredToolName !== undefined
      ? configuredToolName
      : type.startsWith("tool-")
        ? type.slice(5)
        : "tool";
  const registeredRenderer = useToolRenderer(toolName);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  if (Option.isNone(toolPart) || !isTool) return null;

  const input = toolPart.value.input ?? toolPart.value.args ?? toolPart.value.argsText;
  const output = toolPart.value.output ?? toolPart.value.result;
  const errorText = typeof part.errorText === "string" ? part.errorText : undefined;
  const state = toolPart.value.state;
  const outcome = toolPart.value.outcome;
  const errorOutput = Option.isSome(Schema.decodeUnknownOption(ToolErrorOutput)(output));
  const warningOutput = Option.isSome(Schema.decodeUnknownOption(ToolWarningOutput)(output));
  const isFailed = state === "output-error" || outcome === "error" || errorOutput;
  const result =
    output !== undefined
      ? output
      : errorText !== undefined
        ? { type: "error-text" as const, value: errorText }
        : undefined;
  const hasOutput =
    output !== undefined || state === "output-available" || state === "output-error";
  const shouldRenderInput = input !== undefined && toolName !== "render_component";
  const isRunning = isStreaming && !hasOutput;
  // A custom input renderer means the app considers this input primary
  // content (e.g. proposed SQL) — default the group open so it is readable
  // without interaction (audit C4).
  const customInputPrimary = renderToolInput !== undefined && shouldRenderInput;
  const opensByDefault =
    isRunning ||
    isFailed ||
    warningOutput ||
    registeredRenderer !== undefined ||
    toolName === "render_component" ||
    customInputPrimary;
  // User override wins over the computed default; without it every parent
  // re-render would snap a manually-collapsed group back open.
  const open = userOpen ?? opensByDefault;

  return (
    <details
      className="group/tool bg-muted/15 rounded-lg border"
      open={open}
      onToggle={(event) => setUserOpen(event.currentTarget.open)}
    >
      <summary className="text-muted-foreground flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium marker:content-none">
        {isRunning ? (
          <span
            aria-hidden
            className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : (
          <span aria-hidden className="text-[0.9rem] leading-none">
            ⚒
          </span>
        )}
        <span>{toolName.replaceAll("_", " ")}</span>
        <span className="ms-auto font-normal opacity-70">
          {isRunning ? "Running" : isFailed ? "Failed" : warningOutput ? "Warning" : "Completed"}
        </span>
      </summary>
      <div className="border-t px-3 py-2">
        {shouldRenderInput &&
          (renderToolInput !== undefined ? (
            renderToolInput({ toolName, input })
          ) : (
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer">Input</summary>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </details>
          ))}
        {hasOutput &&
          (renderToolResult !== undefined ? (
            renderToolResult({ toolName, result })
          ) : (
            <ToolResultContent toolName={toolName} result={result} className="mt-2" />
          ))}
      </div>
    </details>
  );
};
