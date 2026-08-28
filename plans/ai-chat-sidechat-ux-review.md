# AI sidechat UI/UX review

Status: **review complete**  
Date: 2026-08-28

Implementation status: **addressed**

The reviewed product changes are implemented across the AI chat surface and
workspace handoff. The remaining section records only optional hardening for
live-generation handoff, malformed history messaging, and physical device QA.

Implemented in this pass:

- Guided provider first-run state, stacked narrow-rail form, inline validation,
  API-key visibility, connection testing, and focus-to-first-missing-field.
- Single context strip with explicit attachment counts, data classes,
  removable per-turn context, expandable SQL/result previews, and context
  preservation/removal during full-chat promotion.
- Bounded settings mode with sticky **Done**, compact header hierarchy,
  current-chat/new-chat controls, contextual empty-state prompts, and concise
  disclosure copy with expandable detail.
- Responsive desktop rail/mobile sheet sizing with dynamic viewport and safe
  area handling, status/error/cancellation announcements, focus restoration,
  dialog labelling, and accessible recovery actions.
- Consistent action language across selection, SQL drafting, SQL explanation,
  result explanation, and empty-state AI entry points.

Local verification covered the fixture workspace, sidebar-to-tab behavior,
context removal, full-chat promotion, first-run provider focus, rendered
sidechat layout, formatting, diff checks, and the chat-context test suite.

## Scope

This is a user-facing review of the AI sidechat, based on:

- The supplied sidechat screenshot.
- The current local Dadabase fixture at desktop width.
- The current sidechat/full-chat interaction and accessibility markup.
- The existing contextual attachment, provider, tool, schema, SQL, and bulk-selection flows.

No production connections or provider credentials were used.

## What is already working well

- The left AI rail action now performs the same operation as **New AI assistant tab**: it appends an embedded AI tab and preserves the rest of the workspace URL state.
- The sidechat is contextual: it can receive the active table, filters, selected rows, SQL, and query results.
- Context is removable before sending, and row/result values are gated by explicit data-sharing permissions.
- The sidechat has a clear **Open full chat** escape hatch and a close action.
- The provider, tools, schema, access policy, and chat areas are separate concerns rather than one undifferentiated panel.
- Keyboard support exists for Escape, focus trapping, and the composer send shortcuts.
- The assistant proposes SQL for review instead of silently mutating database data.

## Findings

Priority meanings: P0 blocks or risks the primary task, P1 materially harms comprehension or completion, P2 is polish or a lower-frequency workflow improvement.

| Priority | Area                           | Finding / user impact                                                                                                                                                                                          | Recommended change                                                                                                                                                                                                              | Acceptance criteria                                                                                                                                     |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | First-run state                | When the provider is not configured, the composer and starter prompts are disabled, but the actionable setup path is visually separated above the conversation. The panel can feel broken rather than guided.  | Add a compact first-run state in the sidechat with one primary **Configure provider** CTA, a short explanation of BYOK/local storage, and focus the first invalid/missing field when opened. Keep **Open full chat** secondary. | A new user can tell why chat is disabled and reach the exact required field in one click; disabled controls have an adjacent reason.                    |
| P1       | Provider form at narrow widths | The screenshot shows the provider form using a wide multi-column layout inside a narrow rail. Labels and inputs compete for space and can clip or become difficult to scan.                                    | Use a sidechat-specific stacked form below a comfortable width; reserve the multi-column layout for full chat. Add show/hide API key, inline validation, and a non-destructive **Test connection** action.                      | At 320px, 390px, 640px, and 1024px widths, every label, input, helper, and action is readable without horizontal scrolling.                             |
| P1       | Context comprehension          | The table context banner and attachment chips communicate related information in two separate places. Users may not know whether removing a chip removes the active table, only row values, or just this turn. | Consolidate into one context strip with grouped metadata and explicit copy such as **Attached for this chat** / **Remove for this turn**. Show a count and data class for selection/result attachments.                         | A user can answer “what will be sent?” and “what will be removed?” from the sidechat without opening settings.                                          |
| P1       | Active workspace context       | Sidechat context follows the active workspace tab, while the table navigator can still appear selected when an AI tab is active. This can make the sidechat look unscoped or scoped to the wrong table.        | Make the source explicit in the sidechat header and synchronize navigator selection with the active workspace tab, or show **AI tab context** when no table is active.                                                          | Changing tabs updates the context label predictably; an AI tab never silently inherits a stale table label.                                             |
| P1       | Settings dominance             | Provider, tools, and schema accordions can consume most or all of the sidechat viewport, pushing the conversation and composer below the fold.                                                                 | Present settings as a scrollable drawer/popover or a dedicated settings mode inside the sidechat. Keep the conversation header and composer anchored.                                                                           | Opening settings never makes the composer permanently unreachable; the user can return to the conversation with one obvious action.                     |
| P1       | Access policy                  | Read-only questions should not be blocked by a generic schema-sharing approval step, while write queries still need a deliberate boundary.                                                                     | Default to read-only access, run SELECT/WITH questions directly, and require confirmation only for writes according to the selected Read only / Read & Write / Full Access policy.                                              | A read-only question reaches its result without an approval banner; writes show a scoped confirmation with the SQL and access level.                    |
| P1       | Responsive behavior            | Desktop rail, tablet rail, and mobile bottom sheet are currently treated as roughly two modes. Keyboard resize, safe-area insets, and a 640–1024px tablet viewport need deliberate treatment.                  | Define breakpoints for desktop rail, tablet overlay, and mobile sheet. Use dynamic viewport sizing, safe-area padding, and keep the composer above the virtual keyboard.                                                        | Test at 320/390/768/1024px, landscape mobile, browser zoom 125%/200%, and with a software keyboard. No clipped close/action buttons or hidden composer. |
| P1       | Async/error status             | Provider status, streaming, cancellation, SQL approval, and failures are not all visible in the compact header. A user may not know whether a send is pending, blocked, or failed.                             | Add a small status line or header state for configuring, ready, streaming, cancelled, failed, and awaiting approval. Keep **Stop generating** reachable while streaming.                                                        | Every non-idle state has a visible label, a keyboard-accessible recovery action, and an announcement for assistive technology.                          |
| P1       | Thread continuity              | Sidechat intentionally hides the thread list, but it does not clearly show which conversation is active or offer a quick **New chat** action. Promoting to full chat also needs a clear continuity statement.  | Add a compact current-thread label/menu with **New chat** and **Open full chat**. Explain that promotion preserves the current conversation and attachments.                                                                    | Users can start a fresh conversation without accidentally mixing it with the current one; promotion never loses messages or context.                    |
| P1       | Focus and modal behavior       | Focus trapping and Escape handling exist, but the entire lifecycle needs verification across provider controls, nested popovers, mobile overlay dismissal, and promotion to full chat.                         | Restore focus to the invoking control on close, move focus to the first actionable control on open, and ensure nested menus do not break the trap.                                                                              | Keyboard-only users can open, configure, chat, dismiss, and reopen the sidechat without focus loss.                                                     |
| P2       | Action language                | **Ask AI**, **Suggest query**, and **Explain with AI** are all useful but express similar intents with different verbs.                                                                                        | Standardize on a small action vocabulary: **Ask AI about selection**, **Draft SQL**, and **Explain result**. Keep the object in the label.                                                                                      | The action label tells users what context will be attached before they click.                                                                           |
| P2       | Bulk selection handoff         | The bulk action bar now exposes **Ask AI**, but the sidechat handoff should confirm the selected row count and whether values are attached or metadata-only.                                                   | Show a selection summary chip and offer **Attach values** only when the sample-row permission is enabled.                                                                                                                       | Sending a selected-row question never leaves the user guessing which rows or values are included.                                                       |
| P2       | SQL/result handoff             | SQL and result attachments are powerful but their compact labels are easy to miss, especially when the sidechat is opened from a dense editor.                                                                 | Add a one-line preview with query/result count, an expand affordance, and a clear “values not attached” state.                                                                                                                  | A user can distinguish SQL text, columns-only results, and row values before sending.                                                                   |
| P2       | Empty state                    | The current empty state is explanatory but generic. It does not adapt enough to the entry point (table, selection, SQL, result).                                                                               | Use contextual starters: table exploration, selected-row investigation, SQL explanation, and result summary. Keep them disabled only when the blocking permission is clearly stated.                                            | The first suggested prompt matches the action that opened the sidechat.                                                                                 |
| P2       | Header hierarchy               | Connection name, Ask AI, provider badge, Open full chat, close, and Provider compete in the narrow header. The screenshot demonstrates the crowding risk.                                                      | Keep one title, one status badge, and two primary controls; move provider/settings into an overflow or labeled settings button. Add a tooltip to icon-only close.                                                               | The header remains legible at narrow widths and preserves a stable close target.                                                                        |
| P2       | Data-sharing reassurance       | The current copy is accurate but repeated and verbose in the sidechat. The most important distinction—metadata versus row values—can be missed.                                                                | Replace repeated paragraphs with a concise summary plus an expandable explanation. Keep the full explanation available for auditing.                                                                                            | The compact state communicates what leaves the browser in one scan, with details available on demand.                                                   |
| P2       | Accessibility semantics        | Dialog semantics and labels are present, but status announcements, error focus, heading structure, and duplicate accessible names should be checked in the rendered sidechat/full-chat combination.            | Run a screen-reader pass and add live-region announcements for provider save, consent, streaming, errors, and context removal. Avoid duplicate labels when full chat and sidechat are mounted together.                         | VoiceOver/NVDA can identify the active surface, controls, status, and current context without reading duplicate content.                                |
| P2       | Visual density and contrast    | Dense borders, muted helper text, chips, and disabled controls make the panel visually quiet. The screenshot shows long muted copy competing with the actual task.                                             | Reserve muted text for secondary explanation, increase contrast for actionable status, and use consistent spacing tokens for cards/sections.                                                                                    | Primary action, blocked action, current context, and secondary explanation are visually distinct in light and dark themes.                              |
| P2       | State persistence              | The provider is browser-global, while chat context is ephemeral. That distinction is not always explicit, and users may assume context removal persists or affects future chats.                               | Label persistence boundaries: **Saved in this browser**, **Attached to this chat**, and **Removed for this turn**.                                                                                                              | Users can predict what survives reload, tab changes, full-chat promotion, and sidechat close.                                                           |
| P2       | Keyboard shortcuts             | The composer explains Enter/Shift+Enter/⌘Ctrl+Enter, but the rest of the sidechat has no discoverable shortcut for opening, closing, or focusing chat.                                                         | Add a lightweight shortcut hint in the tooltip/command palette and keep all shortcuts remappable or non-essential.                                                                                                              | Shortcuts accelerate expert use without being required for any primary task.                                                                            |

## Recommended implementation order

1. Fix the first-run/provider setup path and make narrow provider settings usable.
2. Consolidate and clarify context attachments, including selection/result data classes.
3. Make active-tab context and thread continuity explicit.
4. Rework settings as a sidechat mode/drawer so the composer remains reachable.
5. Harden responsive, keyboard, focus, async-status, and screen-reader behavior.
6. Normalize action copy and finish visual-density/persistence polish.

## Explicit non-goals

- Do not silently broaden what is sent to a provider; keep preview rows and query-result sharing as explicit, reversible settings.
- Do not make the sidechat a second independent thread list unless thread continuity is clearly defined.
- Do not replace the embedded AI tab; the sidechat should remain a fast contextual surface with full chat as the deep-work mode.
- Do not couple provider credentials to server-side persistence; the current browser-local BYOK boundary is a useful trust property.

## Follow-up review after implementation

Date: 2026-08-28

The requested sidechat changes are now implemented and rechecked in the local
SQLite fixture at desktop width. The sidechat now behaves as a lightweight
contextual companion; full chat remains the place for thread management and
long-form work.

### Completed from the requested follow-up

- Sidechat placement is a persisted Left/Right preference, available from the
  sidechat settings mode. Mobile continues to use a bottom sheet.
- The header order is now **Open full chat**, icon-only **Settings**, then the
  top-right **Close** action.
- The default sidechat no longer renders the large data-sharing card. It shows
  one setup state and keeps the access policy plus preview-data controls in
  settings; read-only chat is available without a schema approval step.
- Context has an inline **Add tables** picker with search, selected-state
  feedback, and table chips. It is available even when no table is attached.
- Export is grouped under **More** with **Copy as Markdown**, **Export
  Markdown**, and **Copy plain text** actions.
- **Try again** is only passed to a message when the runtime reports a failed
  stream. Successful assistant messages no longer get a misleading retry
  button.
- Conversation ids used for sidechat promotion come from the active runtime
  session, so opening full chat does not accidentally reopen an older global
  conversation. Promoted context remains attached.
- Full-chat thread navigation now uses a wider desktop rail and a wider mobile
  drawer. Loading and failed list hydration have explicit states and a reload
  action.
- Background conversation-store errors no longer mark a completed chat turn as
  a failed stream, preventing unrelated load errors from producing a retry
  affordance.
- Full chat no longer opens into a dominating provider form when setup is
  missing. It keeps the conversation visible, shows a compact setup card, and
  focuses the missing provider field after **Configure provider**.
- Disabled starter prompts are hidden until chat can actually be used, so a
  blocked sidechat no longer presents a wall of inactive controls.
- Partially malformed persisted history now produces a non-blocking warning
  while retaining all messages that can be decoded.

### Remaining opportunities

The product-level items from this review are implemented. These are the only
remaining follow-up identified during the final pass:

| Priority | Area                 | What can still improve                                                                                                                                                 | Suggested next step                                                           |
| -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P2       | Responsive/device QA | Local desktop and fixture smoke checks are covered; physical keyboard/VoiceOver, 320px mobile, landscape mobile, zoom, and virtual-keyboard behavior remain device QA. | Run the documented matrix and record screenshots plus screen-reader outcomes. |

### Verification evidence

- `pnpm typecheck` passes.
- Focused chat/context/protocol tests pass: 33 tests across 5 files.
- Local browser smoke confirms: sidechat opens, the empty context card can add
  a table, the settings placement controls move the panel left/right and
  persist after reload, full-chat promotion retains context, and a fresh load
  produces no browser error/warning logs. While streaming, full-chat promotion
  is deferred until the active response settles so the same runtime session is
  retained.

## Final persistence and result-presentation pass — 2026-08-29

Status: implemented locally and covered by focused tests and deterministic E2E
scenarios.

### Completed

- Persist chat messages as protocol-compatible parts at the API boundary. Raw
  provider/UI message parts are no longer written directly to the database,
  and an unsupported optional part cannot make an otherwise readable message
  disappear during restoration. This closes the empty-thread failure mode
  behind previously saved conversations.
- Keep sidechat state mounted while minimized. Closing the panel now hides it
  and restores focus without clearing the active runtime, context, draft, or
  conversation. Opening full chat continues the same conversation instead of
  creating a fresh session.
- Always add a new sibling SQL editor tab when **Use this SQL** is clicked;
  the active AI/table tab and its state remain available in the workspace.
- Remove duplicate SQL from successful `run_sql` cards. The query is now
  collapsed by default, while returned rows are shown through the readable
  preview-table component and labeled as a live workspace query result.
- Remove low-value model/token/context receipt metadata from the normal chat
  surface. Detailed setup and sharing controls remain available from the
  settings surface.
- Keep **Attach tables to context** in the sidechat header and avoid rendering
  a large empty context card when automatic schema selection is active. The
  picker stays open after each selection so multi-table attachment is quick.
- Remove obsolete E2E expectations for hidden token totals and context
  receipts; retain coverage for readable results, collapsed query details,
  provenance, tab replacement, full-chat promotion, and sidechat visual states.
- Add a regression assertion that running a query leaves the SQL editor content
  intact after results render.

### Remaining review items

These are polish or product extensions, not blockers for the requested UX:

| Priority | Area              | Improvement                                                                                                                          |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| P2       | Provenance        | Add structured source tables, filters, execution time, and request ID when the backend exposes stable lineage fields.                |
| P2       | Result previews   | Apply the same readable-column and FK-enrichment treatment to arbitrary SQL result sets, not only preview-row tool output.           |
| P2       | Responsive QA     | Validate 320px widths, landscape mobile, browser zoom, virtual keyboards, keyboard-only navigation, and VoiceOver with real devices. |
| P3       | Settings polish   | Give provider configuration a more compact form layout and make the settings mode visually distinct from conversation content.       |
| P3       | Full-chat density | Keep long tool cards collapsed by default and add a single “show technical details” affordance for advanced users.                   |

The remaining items are intentionally separate from message persistence: they
need either richer backend lineage contracts or device-level visual/accessibility
verification.
