# AI chat and contextual sidechat plan

Status: **complete** · Created: 2026-08-28 · Order: **trust first, then sidechat, then ergonomics and polish**

## Context

Dadabase already has a first-class AI assistant route with persistent conversations,
streaming, schema consent, schema selection, configurable tools, SQL approval, SQL
handoff, retries, exports, and mobile thread navigation. The full-page route is a
good deep-work surface, but it is too heavy for quick questions asked while browsing
a table, inspecting rows, editing SQL, or looking at relationships.

The UI review also found a trust mismatch: the consent copy currently promises that
row data and query results are never sent, while row-returning tools can return those
values to the model for continued generation. Tool permissions are also presented as
one flat list with all tools enabled by default.

Relevant architecture:

| Concern          | Location                                                    | Current mechanism                                                                 |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Full AI page     | `src/components/pages/connection-page/ai-chat.page.tsx`     | Chat provider, thread list, settings, composer, messages, tool cards              |
| AI route         | `src/routes/connections/$connectionName.ai.tsx`             | Connection-scoped full-page AI route with `thread` and `askTable` search params   |
| Workspace shell  | `src/components/pages/connection.page.tsx`                  | Connection navigation, tabs, main content, query logger, child route outlet       |
| Chat runtime     | `src/components/pages/connection-page/use-chat-runtime.tsx` | Shared AI SDK/runtime integration and persistence events                          |
| AI API           | `src/routes/api/chat.ts`                                    | Schema filtering, tool registration, streaming, approval, database tool execution |
| Provider storage | `src/lib/ai-byok.ts`                                        | Browser-local provider/model/key configuration                                    |
| Consent          | `src/lib/ai/chat-consent.ts`                                | Per-connection browser-local consent state                                        |
| Schema selection | `src/lib/ai/chat-schema-selection.ts`                       | Per-connection all/selected/auto selection state                                  |

## Goal

Make AI feel like a trustworthy, contextual layer over the database workspace:
users can ask quick questions from where they are, understand exactly what data is
shared, safely approve database actions, and promote a contextual conversation into
the full AI workspace without losing state.

## What

### In scope

- Correct schema/row/result consent and data-disclosure copy.
- Group and safely default AI tools by capability and risk.
- Make SQL approval show meaningful impact context.
- Add a desktop contextual sidechat rail.
- Add a mobile sidechat bottom sheet/drawer.
- Share conversation/runtime/context between sidechat and full AI route.
- Attach table, filter, selected row/cell, SQL, schema, and result context.
- Add an explicit “Open in full chat” promotion flow.
- Improve provider onboarding and clarify browser-global configuration.
- Improve mobile layout and reduce configuration dominance.
- Improve composer behavior, including auto-grow and drafting while streaming.
- Improve message, tool-result, SQL, and preview-table presentation.
- Improve thread navigation, accessibility, focus handling, and responsive behavior.
- Add tests for the new trust, context, sidechat, and responsive contracts.

### Deliberately out of scope

- Training, retention, or provider policy claims beyond what the configured provider
  and local storage behavior can actually guarantee.
- A second independent chat state or duplicate thread database for sidechat.
- Autonomous writes or bypassing approval for SQL execution.
- A hosted AI proxy or server-side secret-management product.
- Replacing the existing full AI page with sidechat.
- A complete model marketplace or provider billing system.

## Why

The full-page chat is discoverable but interrupts database work. Contextual entry
points should let a user ask “what am I looking at?” or “explain this result?” without
leaving the table. A sidechat also makes AI useful in the most important product
surfaces while preserving the full route for long conversations and complex SQL.

Trust is a prerequisite. Users should never have to infer whether a preview, query
result, or selected row was shared with an external provider.

## How

### Shared context model

Define a serializable context envelope used by both presentations:

```ts
type ChatContextAttachment =
  | { kind: "schema"; schema: string; tables: string[] }
  | { kind: "table"; schema?: string; table: string }
  | { kind: "selection"; schema?: string; table: string; columns: string[]; rowIds?: string[] }
  | { kind: "filters"; schema?: string; table: string; filters: unknown[] }
  | { kind: "sql"; sql: string; source: "editor" | "result" | "assistant" }
  | { kind: "result"; columns: string[]; rowCount: number; rows?: unknown[] };
```

The envelope is shown before sending and recorded in the per-message context
receipt. It must distinguish metadata-only context from row/result context.

### Sidechat layout

```text
┌──────────────┬──────────────────────────────────────┬───────────────┐
│ connection   │ table / SQL / schema workspace        │ contextual AI │
│ navigation   │                                      │ sidechat      │
│              │                                      │ 380–420px     │
└──────────────┴──────────────────────────────────────┴───────────────┘
```

- Desktop: right rail, default width 400px, resizable where the shell allows it.
- Tablet: collapsible rail or sheet; avoid squeezing workspace, query logger, and
  chat simultaneously.
- Mobile: bottom sheet or full-width drawer with focus trapping and restoration.
- Sidechat: current conversation plus context summary and “Open full chat”.
- Full AI: complete thread list, settings, and deep-work conversation surface.

### Trust model

Use explicit data classes:

- Schema metadata: table, column, type, key, and relationship metadata.
- Sample rows: values returned by Preview rows or attached selections.
- Query results: values returned by executed SQL.

Schema consent and row/result consent are separate. Row-returning tools are not
implicitly enabled by schema consent. Every turn records the effective data class,
tables, tools, and context attachments.

### Tool model

Group tools into:

- Inspect: Table details, Explain SQL.
- Navigate: Open workspace view.
- Draft: Propose SQL.
- Read rows: Preview rows.
- Execute: Run SQL.

Safe inspection/drafting tools may be enabled by default. Preview rows and Run SQL
require explicit opt-in and remain approval-gated where appropriate.

## What this allows

- Ask AI about the current table without leaving the workspace.
- Ask about selected rows/cells or a current filter.
- Explain SQL and query results in place.
- Promote a contextual question into the full AI tab.
- See exactly which context and data class each turn used.
- Safely preview or execute queries with understandable approvals.
- Use the AI UI comfortably on desktop, tablet, and mobile.

## What this does not allow

- Silent sharing of row values under a schema-only consent decision.
- Silent writes to a database.
- Sidechat-specific conversations that diverge from the full chat history.
- Treating a URL as a safe place for provider secrets or private row data.
- Assuming provider retention or training behavior not verified for the configured
  endpoint.

## UI & UX

### Full AI route

- Compact provider readiness/status bar after setup.
- Provider/tools/schema settings in an expandable panel on desktop and a sheet on
  mobile.
- Suggested prompts based on actual tables.
- Wider response area for SQL and result tables.
- Stronger grouping between user turns and assistant/tool work.
- Sticky auto-growing composer.

### Sidechat

- Entry point in table, row/cell selection, filter, SQL editor, schema, and results
  surfaces.
- Context chips with remove actions.
- Data-sharing badge visible before send.
- Current thread chip, close button, and “Open full chat”.
- No full thread list unless explicitly requested.

### Safety copy

Use plain labels such as:

- “Schema names only.”
- “This question includes 8 sample rows.”
- “This query returned 25 rows to the AI provider.”
- “Review this SQL before it runs.”

## Data model

No new server persistence is required for the first implementation. Context
attachments should be ephemeral message metadata, with only the existing conversation
message persistence updated to retain the disclosure receipt.

Client-local state may store:

- Sidechat open/collapsed state and width per connection/workspace.
- Last sidechat/full-chat presentation.
- Consent decisions per connection and data class.
- Tool settings per browser/connection according to the existing storage contract.

Provider keys remain browser-local and must never be included in URL state.

## Implementation steps

### Phase 1 — Trust and safety

- [x] Add data-class consent and correct all trust copy.
- [x] Prevent Preview rows and result-returning execution from bypassing row consent.
- [x] Group tools by capability/risk in the tool descriptions and receipts; preserve existing tool toggles.
- [x] Improve SQL approval details by preserving and showing the proposed SQL.
- [x] Fix schema loading labels so introspection does not appear as zero tables.
- [x] Add client tests for the disclosure contract.

### Phase 2 — Shared context and sidechat

- [x] Define a general shared context attachment type and serialization for tables,
      filters, selections, SQL, and results.
- [x] Add sidechat shell integration to the connection workspace.
- [x] Add desktop rail and mobile bottom-sheet composition.
- [x] Add the active-table contextual entry point.
- [x] Reuse the existing runtime/thread persistence path.
- [x] Add full-chat promotion and close/focus-return behavior.
- [x] Preserve workspace tabs and layout when sidebar, icon-rail, command-palette,
      or sidechat links open the full AI route.

### Phase 3 — Onboarding and composer

- [x] Compact provider setup and collapse after configuration.
- [x] Clarify provider scope/storage; a provider connection test remains a future
      follow-up because endpoints do not share a reliable provider-neutral probe.
- [x] Add auto-growing composer.
- [x] Allow drafting during streaming; queued follow-ups remain a follow-up.
- [x] Add schema-aware starter prompts based on the available table list.
- [x] Add general context attachment controls for selections and result values;
      bulk selection, SQL editor, and result surfaces can open the sidechat with
      removable attachments.

### Phase 4 — Conversation quality and accessibility

- [x] Improve turn rhythm and adaptive response width.
- [x] Upgrade tool card labels and approval visibility.
- [x] Add selected message actions where relevant (copy, edit, retry, fork,
      remember, and Markdown export already ship in the thread message footer).
- [x] Add context/cost estimates and better streaming/error states (per-message
      token counts, thread totals, context receipts, elapsed streaming status,
      cancel, retry, and jump-to-latest are present).
- [x] Add sidechat dialog semantics, focus management, and keyboard affordances.
- [x] Add reduced-motion handling for chat loading and status animations.
- [x] Complete the remaining tablet, browser-zoom, and light/dark visual matrix
      implementation safeguards (responsive sheet/rail sizing, overflow-safe
      attachment chips, keyboard focus trapping, Escape close, and reduced motion).

### Phase 5 — Validation

- [x] Run focused unit/server tests with `--run` (AI data-access and chat protocol tests).
- [x] Run typecheck.
- [x] Exercise local e2e fixtures only (manual desktop/mobile sidechat smoke).
- [x] Verify the remaining tablet, browser-zoom, reduced-motion, and light/dark
      visual matrix implementation safeguards locally; full device/browser coverage
      remains an environment-level QA follow-up.
- [x] Update this plan with completed decisions and remaining follow-ups.

Repository validation note: the focused checks pass. The full Vitest suite was
stopped after unrelated PGlite/Testcontainers health-check timeouts, and the
repository lint command still reports existing violations outside this change.

## Acceptance criteria

- Schema-only consent never sends row values or query results to the provider.
- Row/result sharing is explicit, visible before send, and represented in receipts.
- Unsafe tools are not silently enabled by a schema-only setup.
- SQL approvals expose the exact SQL and meaningful impact/safety information.
- Sidechat opens from contextual workspace surfaces and preserves the same thread when
  promoted to full chat.
- Sidechat does not create a duplicate chat state or second persistence path.
- Sidechat is usable at desktop, tablet, and mobile widths.
- Provider setup no longer pushes the composer below the initial mobile viewport.
- Composer supports multiline input, draft persistence, and drafting while streaming.
- Long SQL, tool output, and result tables remain usable without horizontal page
  overflow.
- Mobile drawers have correct focus and dialog semantics.
- Existing AI functionality remains covered and no console errors are introduced.

## Open questions

- Should query-result sharing be a one-time consent, per-thread consent, or per-turn
  consent? Initial implementation should prefer per-turn visibility with a durable
  opt-in setting.
- Should sidechat use the currently active full-chat conversation or a dedicated
  contextual conversation? Prefer the active conversation when one exists, with a
  clear new-context/new-chat action.
- Should provider settings eventually be per connection? Current implementation can
  first clarify browser-global scope, then migrate to profiles if needed.

## Decisions log

- 2026-08-28: Build sidechat as a contextual companion to the full AI tab, not a
  replacement or separate chat system.
- 2026-08-28: Trust/data-disclosure cleanup precedes sidechat implementation.
- 2026-08-28: Preserve the existing full AI surface and reuse its runtime/thread
  persistence.
- 2026-08-28: Keep provider secrets browser-local and out of URL state.
- 2026-08-28: Full AI navigation intentionally retains parent workspace search
  state; tabs and layout are part of the user's working context, not stale query
  noise to strip.
- 2026-08-28: Starter prompts use resolved table names and only seed the local
  composer; they do not silently attach row values.
- 2026-08-28: Context attachments are ephemeral request data. The client and API
  both strip selected-row/result values unless their matching data class is enabled;
  persisted receipts retain only counts, columns, and sharing flags.
