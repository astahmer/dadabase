// Type-only stub vendored for the chat runtime (Phase A).
// The full WebMCP host (@emi/core src/web/webmcp.ts + webmcp-actor) was
// consciously not ported — only these types are referenced by runtime/types.ts.
export interface WebMcpTool {
  readonly name?: string;
  readonly [key: string]: unknown;
}

export interface WebMcpModelContext {
  registerTool(
    tool: WebMcpTool,
    options?: {
      readonly signal?: AbortSignal;
      readonly exposedTo?: ReadonlyArray<string>;
    },
  ): Promise<void>;
}
