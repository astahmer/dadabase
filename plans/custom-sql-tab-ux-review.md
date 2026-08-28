# Custom SQL tab UI/UX review

Status: **review complete**  
Date: 2026-08-28

## Review brief

This is a user-facing review of the connection workspace's Custom SQL tab. It
covers the editor, multi-statement execution, query results, favorites,
history, keyboard shortcuts, AI actions, and the surrounding layout. The
review used the local SQLite fixture at desktop width in light and dark themes;
no production connection, credential, or provider was used.

The requested bug fixes and the actionable P0–P2 follow-up work are implemented
in the current working copy. The useful bounded P3 work is implemented where it
can be safely supported by the current contracts; the P3 section records the
remaining session-level product/backend contracts explicitly.

## Executive conclusion

The Custom SQL tab already has a strong power-user foundation: Monaco editing,
schema-aware completion, diagnostics, statement parsing, result tabs, table and
visualization modes, AI drafting/explanation, query history, and favorites. The
main UX problem is not missing capability. It is that the tab exposes too many
controls before the user has established a simple loop:

```text
write or select SQL → run exactly that scope → inspect one result → refine/save
```

The highest-leverage direction is to make execution scope and persistence
state continuously obvious, while progressively disclosing AI, formatting,
history, and advanced result controls.

## What is working well

- Monaco provides a familiar editor with SQL highlighting and completion.
- The editor supports multi-statement scripts and now exposes per-statement
  Run and Explain actions.
- Cmd/Ctrl+Enter and Cmd/Ctrl+S are available at the editor level.
- Results are separated into named result tabs instead of replacing one another.
- The result surface supports table and visualization modes.
- Query history and favorites provide a useful recovery path for exploratory
  work.
- SQL can be copied, formatted, explained with AI, or drafted with AI.
- The editor can be expanded or put into fullscreen mode.
- The local fixture showed no fresh browser console warnings or errors during
  the review.

## Priority model

- **P0**: causes data loss, unintended execution, or loss of a primary workflow.
- **P1**: materially blocks execution, interpretation, or recovery.
- **P2**: recurring friction, density, or discoverability problems.
- **P3**: polish and lower-frequency power-user improvements.

## Completed fixes in this pass

| Area                   | User-visible result                                                                                                                                                                       | Evidence                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Statement execution    | The active selection or statement under the cursor is used for Run and Explain; multi-statement execution no longer falls through to a second whole-script execution.                     | `sql-monaco-editor.impl.tsx`, `sql-query-preview.tsx`, `connection.page.tsx` |
| Inline actions         | Multi-statement scripts render statement-level Run and Explain controls wired to the corresponding SQL text.                                                                              | `sql-editor-view-zones.ts`, `sql-monaco-editor.impl.tsx`                     |
| Save shortcut          | Cmd/Ctrl+S saves the selected/current statement as a favorite.                                                                                                                            | `sql-monaco-editor.impl.tsx`                                                 |
| Favorite feedback      | The Tools menu changes to “Saved to favorites” with a checkmark after a successful save.                                                                                                  | `sql-query-preview.tsx`                                                      |
| Find discoverability   | Tables expose a visible Find button in addition to Cmd/Ctrl+F.                                                                                                                            | `data-table.tsx`                                                             |
| Editor persistence     | Resizing the query-history splitter no longer remounts the SQL editor and clears a draft.                                                                                                 | `connection.page.tsx`                                                        |
| Search values          | Arrays and objects render as readable JSON rather than `[object Object]`; null and primitives remain explicit.                                                                            | `global-data-search-sheet.tsx`                                               |
| Execution clarity      | Run/Explain scope is reflected in the toolbar; Run all is explicit; multi-statement runs are sequential, destructive scripts are confirmed once, and partial failure remains inspectable. | `sql-execution-scope.ts`, `connection.page.tsx`, `sql-query-preview.tsx`     |
| Draft recovery         | SQL drafts are kept per connection/tab in browser storage; competing shared/local drafts open an explicit chooser before either draft is kept.                                            | `sql-draft-storage.ts`, `connection.page.tsx`                                |
| Atomic execution       | Multi-statement write scripts can be run atomically from Tools; the server reserves one connection, rolls back on failure, and reports the committed result.                              | `introspection.ts`, `execute-custom-sql.start.ts`, `sql-query-preview.tsx`   |
| Result inspection      | Result tabs identify their statement, loaded-row filtering is plain-language search, results can be copied/downloaded, and long values open in a cell inspector.                          | `connection.page.tsx`, `data-table.tsx`                                      |
| Keyboard/accessibility | The SQL Tools menu exposes shortcut help; statement view-zone controls have statement-specific accessible names and titles.                                                               | `sql-query-preview.tsx`, `sql-editor-view-zones.ts`                          |
| Responsive layout      | The Custom SQL header and editor use compact, wrapping spacing with a smaller narrow-screen editor minimum height.                                                                        | `connection.page.tsx`                                                        |

## Findings

### P0 — execution safety and state integrity — implemented

| Finding / user impact                                                                                                                                                                                | Recommended change                                                                                                                                                                                                                                    | Acceptance criteria                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A script can contain both read and write statements, but the UI does not make the execution scope, ordering, or partial-failure behavior prominent. A user may think Run is atomic when it is not.   | Add an execution summary before running multiple statements: statement count, read/write classification, and whether the connection supports a transaction. For writes, use an explicit “Run 2 statements” label and preserve per-statement outcomes. | A user can tell exactly how many statements will run, in what mode, and whether an earlier success remains after a later failure. |
| “Run selected SQL” appears in the header while the main Run button can execute the current statement or selection. The phrase is ambiguous when there is no selection and multiple statements exist. | Use one scope label beside Run: `Run statement`, `Run selection`, or `Run all 2` based on current editor state. Keep the keyboard hint beside the same scope.                                                                                         | The label always describes the SQL that will execute without requiring the user to infer cursor behavior.                         |
| A draft can be changed after results are produced, but the relationship between the visible results and current editor text is subtle.                                                               | Stamp each result with a short query identity, execution time, and source scope (`selection`, `statement 2`, or `script`).                                                                                                                            | A user can tell which draft produced the active result even after editing the script.                                             |

### P1 — primary workflow — implemented

| Finding / user impact                                                                                                                                                           | Recommended change                                                                                                                                                                    | Acceptance criteria                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The toolbar has Draft SQL, Explain SQL, Run, Tools, maximize, reset, snippets, and a second SQL toggle. On a narrow window this reads as one undifferentiated action row.       | Keep Run primary; keep Reset and one AI action visible; move snippets, Explain, format, copy, favorite, and layout actions into clearly grouped menus.                                | The primary action is obvious in under a second and the toolbar remains usable at 768px.                             |
| Inline Run/Explain strips are useful for multi-statement scripts but add vertical height and can look like extra editor rows.                                                   | Give the strips a subtle “statement 1/2” scope cue on hover/focus and reserve them for scripts with at least two parsed statements. Keep the toolbar as the canonical action surface. | Users understand that inline actions target one statement and do not mistake them for editable SQL.                  |
| The selected statement is not visibly reflected in the toolbar. The user can place the cursor in a statement and accidentally run it without a strong scope signal.             | Add a compact scope badge such as `Statement 2 of 3` or `Selection · 18 lines` near Run.                                                                                              | Moving the cursor or selecting text updates the scope indicator immediately.                                         |
| Reset is potentially destructive to a valuable draft, while the same action also restores UI controls.                                                                          | Split “Restore generated SQL” from “Reset editor layout,” and show a dirty-state confirmation only when the draft differs from the generated query.                                   | Reset never silently discards edited SQL; the user can predict exactly what will be restored.                        |
| Favorite save feedback currently appears after opening Tools, while Cmd/Ctrl+S has no persistent status in the editor chrome.                                                   | Add a low-noise status next to the SQL title: `Saved`, `Unsaved changes`, or `Saving…`; retain the menu checkmark and toast as secondary feedback.                                    | After saving, the user can see the saved state without reopening a menu. Editing changes it back to Unsaved changes. |
| Query history and favorites are global connection actions but are visually separated from the active SQL tab. Returning to an old query requires understanding another surface. | Add a compact “Open from history” / “Open favorite” entry in the SQL tab's Tools menu, preserving the existing full panels.                                                           | A user can recover a previous query from inside Custom SQL without losing the current draft unexpectedly.            |
| Result 1 / Result 2 communicates order but not content. With several statements, users must click tabs to remember which is which.                                              | Name result tabs from statement position plus a short operation, e.g. `2 · users (10)`, and expose the full SQL in a tooltip or details popover.                                      | Result tabs remain distinguishable after three or more statements.                                                   |
| The result filter placeholder is implementation-oriented (`r.name.includes('test')`) and does not explain whether filtering is local, regex-based, or case-sensitive.           | Use plain language such as `Filter rows…`, add a small filter-help affordance, and show a match count.                                                                                | A first-time user can filter result rows without understanding a code expression.                                    |

### P2 — density, clarity, and recovery — implemented

| Finding / user impact                                                                                                                           | Recommended change                                                                                                                                             | Acceptance criteria                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Connection identity, dialect, schema, write status, keyboard hint, and Custom SQL heading occupy a tall header before the editor.               | Collapse stable connection metadata into a compact subtitle or hoverable badges; keep write status visible because it affects safety.                          | The first viewport gives more space to SQL and results without hiding execution-critical state.                       |
| The SQL/editor collapse control is duplicated between the top filters row and the editor header.                                                | Use one canonical control and make the other a passive status/anchor, or clearly distinguish “collapse panel” from “open SQL tab.”                             | There is no ambiguity about whether clicking the control hides the editor or changes workspace tabs.                  |
| The empty state says “Write your SQL query” but does not show a minimal example or schema insertion path.                                       | Add one safe read-only example and a single `Insert from schema` action; keep AI drafting secondary.                                                           | An empty tab gives a clear first action without requiring prior SQL knowledge.                                        |
| Errors are shown near the result surface but can be separated from the statement that caused them.                                              | Attach errors to the statement/result tab, include line range when available, and provide `Copy error` plus `Run again` only for retryable failures.           | A multi-statement failure identifies the exact statement and does not suggest retry for a syntax or permission error. |
| Loading state can leave the editor visible, but the result surface does not always communicate whether old results are stale or being replaced. | Show an inline execution progress label and mark existing results as `Previous result` until the new run completes.                                            | Users never confuse stale data with the result of the current run.                                                    |
| Copy and export options are scattered across results and editor actions.                                                                        | Use one action menu for SQL copy/export and one result action menu for result copy/export/CSV; keep the primary table view uncluttered.                        | Every export action has an obvious scope and does not compete with Run.                                               |
| The table result is wide and dense. Long values are truncated without a consistent way to inspect the complete value.                           | Add a cell inspector/popover with copy, JSON formatting, and null/type information; preserve horizontal scrolling for comparison.                              | A user can inspect and copy a long value without losing their place in the table.                                     |
| Visualize is presented next to Table, but there is no indication when the selected result cannot be charted meaningfully.                       | Keep Visualize available, explain unsupported shapes, and offer a small column-mapping prompt rather than a blank chart.                                       | Visualization failure is actionable and does not look like missing data.                                              |
| AI actions are adjacent to core SQL controls and can be mistaken for execution.                                                                 | Use a separated `AI` group and explicit labels such as `Draft with AI` / `Explain with AI`; retain the existing provider/setup guard.                          | AI actions are visually distinct from Run and never imply that SQL will execute automatically.                        |
| Fullscreen/maximize has two meanings: expanding the panel and taking over the viewport.                                                         | Use `Expand panel` and `Fullscreen` as separate named actions with consistent icons and descriptions.                                                          | The user can predict whether the table remains visible after choosing a layout action.                                |
| The editor does not expose a strong unsaved indicator when navigating between workspace tabs.                                                   | Show a dot or `Unsaved` marker on the SQL tab and warn only when closing a dirty tab, not on every resize/navigation.                                          | A dirty draft is visible in the tab strip and is protected from accidental close.                                     |
| Monaco keyboard behavior is powerful but discoverability is low.                                                                                | Add a compact shortcuts popover containing Run, save, format, find, and fullscreen; use platform-specific labels.                                              | Keyboard users can discover the core commands without reading documentation.                                          |
| Accessibility semantics for the editor's inline action zones and result tabs are minimal.                                                       | Add accessible names containing the statement scope, ensure focus order follows source order, and announce result completion/errors.                           | Screen-reader and keyboard users can identify and operate statement actions independently.                            |
| The current desktop layout does not define a narrow-screen strategy for editor/results.                                                         | At narrow widths, stack editor above results, keep a sticky Run bar, and move secondary actions into overflow.                                                 | 320px and 390px layouts remain operable without horizontal scrolling of the entire page.                              |
| URL/deep-link state can be useful for restoring workspace state, but SQL drafts may become too large or expose sensitive text when shared.      | Keep durable favorites/history local to the connection store; use URL state only for explicitly shareable, sanitized view state and show when SQL is included. | Sharing a workspace never silently exposes a private query draft.                                                     |

### P3 — power-user improvements — bounded follow-ups

- Add named SQL tabs and optional query titles instead of relying on `New Tab`.
- Add duplicate-query detection when saving favorites, with an explicit update or
  save-as-new choice.
- Support snippets with parameters and a small schema browser that inserts a
  quoted table/column reference at the cursor.
- Preserve cursor position and scroll position when switching result tabs,
  opening history, resizing panels, or returning from fullscreen.
- Add optional query timing, row count, and affected-row count beside each
  result tab.
- Add persistent transaction controls for supported connections: begin, commit,
  rollback, and a visible “transaction active” status. This is now implemented
  with a server-side reserved connection, serialized session operations,
  connection ownership checks, dialect-aware commands, and automatic idle
  rollback. The shipped `Run all atomically (rollback on failure)` action still
  covers the safe one-shot contract. Persistent sessions are intentionally
  bounded to one server process and a 15-minute idle TTL; multi-process
  deployments need session affinity or a shared transaction-session service.
- Add a “run on current statement” command to the editor context menu and keep it
  aligned with the toolbar's calculated scope.
- Add per-result copy/export and a result pinning affordance for comparing two
  statements.
- Add a small schema/table context receipt when the SQL tab was opened from a
  table, without turning the editor into a second table browser.
- Add a recoverable draft snapshot after a crash or accidental reload, with an
  explicit restore action rather than silent replacement. **Implemented:** clean
  page unloads are marked separately from interrupted sessions; only the latter
  show the crash-specific restore banner, while competing shared/local drafts
  still open an explicit chooser.

## Recommended build order

1. Make execution scope and multi-statement safety visible: scope badge, count,
   read/write summary, and per-statement failure state.
2. Add dirty/saved status and safe reset/close behavior.
3. Simplify and regroup the toolbar, then improve result-tab naming and stale
   result states.
4. Improve errors, result filtering, cell inspection, and export scopes.
5. Apply the responsive and accessibility pass across editor, inline zones, and
   results.
6. Add remaining power-user enhancements such as named tabs, snippets, and
   crash-specific draft recovery. Persistent transactions are shipped for the
   supported connection types, with the deployment boundary documented above.

## Validation matrix

Before closing the follow-up work, test the following locally:

- The focused E2E feature now covers table-independent execution, direct favorite
  opening, atomic multi-statement execution, and persistent commit/rollback;
  keep it as the regression entry point for the visible Custom SQL workflow.

- one read-only statement;
- two read-only statements with cursor-scoped and selection-scoped execution;
- a syntax error in statement 2;
- a read followed by a write on a writes-enabled connection;
- Cmd/Ctrl+Enter, Cmd/Ctrl+S, Cmd/Ctrl+F, and format shortcuts on macOS and
  Windows/Linux labels;
- save, edit, reset, close, reopen from history, and reload behavior;
- result filtering, long JSON values, copy, export, table mode, and visualize
  mode;
- editor/results resizing and fullscreen at 320, 390, 768, 1024, and desktop
  widths in light and dark themes;
- keyboard-only and screen-reader traversal of the toolbar, editor zones,
  result tabs, and error states.

## Explicit non-goals

- Do not remove Monaco or the existing result-table workflow.
- Do not make AI drafting or explanation part of the execution path.
- Do not silently run all statements when the user has selected or cursor-scoped
  one statement.
- Do not expose query text in share URLs without an explicit user action.
- Do not add permanent metadata columns or dense controls to the result table
  when progressive disclosure can provide the same capability.

## Post-fix UI/UX review

The editor-reset regression is fixed and covered by the table-workspace and
multi-statement E2E scenarios. The remaining review is intentionally a backlog;
these items are not silently included in the reset fix.

### P1 — reduce cognitive load around the primary loop

| Observation                                                                                                                              | Improvement                                                                                                                                                                   | Why it matters                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The header combines scope, dirty state, AI actions, snippets, favorites, format, explain, run, transactions, tools, and layout controls. | Keep `Run` and the calculated scope prominent; move AI, snippets, format, copy, favorite, fullscreen, and shortcuts into two labeled overflow groups.                         | A new user can find the safe primary action without learning the entire toolbar. |
| `Run` can mean the cursor statement, a selection, or the whole script.                                                                   | Render the action label as `Run statement`, `Run selection`, or `Run all N statements`; keep the shortcut beside it.                                                          | The destructive consequence of a click becomes predictable.                      |
| Transaction state is visible but easy to overlook beside other controls.                                                                 | Add a compact amber/green transaction banner above the editor with elapsed time, connection scope, and `Commit` / `Rollback`; warn before leaving with an active transaction. | Open transactions are high-risk state, not just another toolbar mode.            |
| Per-statement view-zone actions are useful but visually noisy in multi-statement SQL.                                                    | Show them on hover/focus, preserve them for keyboard navigation, and add one explicit `Run current statement` command to the editor menu.                                     | Power users keep precision without every line looking like a toolbar.            |
| The editor is visually similar to a preview panel even though it is always editable.                                                     | Use a clear `SQL editor` heading, a visible saved/unsaved marker, and a short hint only on first use.                                                                         | Users should know immediately whether typing is safe and persistent.             |

### P1 — separate draft, execution, and result state

| Observation                                                                                                       | Improvement                                                                                                                          | Why it matters                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| The editor draft, stored execution, URL tab state, and local recovery state are related but not obvious to users. | Add a small state receipt: `Draft`, `Last run`, and `Saved favorite`, with timestamps and a `Reset to last run` action.              | It prevents uncertainty about what will run and what is being displayed. |
| Results can become stale after the draft changes.                                                                 | Mark results `Stale — draft changed` and provide `Run draft`; do not imply the result belongs to current text.                       | Prevents decisions based on an older query.                              |
| Result tabs such as `Result 1 (5)` are low-signal.                                                                | Name them from statement index plus short SQL label, row count, and duration; allow renaming only when useful.                       | Multiple results become scannable and comparable.                        |
| Rows affected and result rows use different empty states.                                                         | Standardize success, zero-row, rows-affected, cancelled, and failed states with the next action in each.                             | Users can distinguish “nothing matched” from “nothing ran.”              |
| The result toolbar mixes filtering, table/chart presentation, export, and explain-result controls.                | Keep `Table` / `Visualize` as the view switch; put copy/export and explain in a result menu; show active result metadata next to it. | The result surface reads as a result, not a second command center.       |

### P1 — safety, errors, and recovery

| Observation                                                                                            | Improvement                                                                                                                                              | Why it matters                                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Destructive confirmation describes the operation but not the exact execution scope or affected tables. | Include statement count, connection name, transaction mode, and a collapsed SQL preview; keep `Cancel` as the safe default focus.                        | Users can verify the blast radius before execution.           |
| Persistent transactions have a server TTL and process-local lifetime.                                  | Show the expiry countdown/last activity, explain that reload or server restart rolls back, and surface an explicit “session unavailable” recovery state. | The UI must match the actual durability contract.             |
| A failed statement in a sequential script can leave earlier statements committed.                      | Show a prominent partial-execution banner listing completed and failed statement indices, with a link to the exact SQL.                                  | “Script failed” is insufficient when writes already happened. |
| Retry is only safe for some failures.                                                                  | Keep retry hidden for syntax/permission/read-only failures and say why; allow retry with the original scope after transient failures.                    | Avoids duplicate writes and gives a useful next step.         |
| Reset/close protection is easy to miss when the tab strip is crowded.                                  | Put the dirty dot on the tab, use a close confirmation only for dirty drafts, and make `Reset draft` explicit in the menu.                               | Protects work without interrupting ordinary navigation.       |

### P2 — favorites, history, and sharing

| Observation                                                                                      | Improvement                                                                                                                         | Why it matters                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Favorites and recent executions share visual space and can look interchangeable.                 | Add clear `Favorites` and `Recent` filters, with a distinct saved-star treatment and count.                                         | Users can find durable queries quickly.                           |
| Long SQL labels are truncated without enough context.                                            | Use the first meaningful clause/table as the title, show the full SQL on hover, and allow a custom title.                           | Favorite rows remain identifiable without wasting vertical space. |
| Saving multi-statement SQL does not explain whether it saves the entire editor or one statement. | Show `Save full script` / `Save current statement` in the save action when scope differs.                                           | Removes ambiguity around reusable scripts.                        |
| Duplicate favorites can accumulate.                                                              | Detect identical normalized SQL and offer `Update existing` or `Save as new`.                                                       | Keeps the library clean.                                          |
| Query text can be sensitive while URL state is shareable.                                        | Keep drafts out of share URLs by default; provide an explicit sanitized `Copy share link` action and show exactly what is included. | Makes privacy behavior understandable.                            |

### P2 — responsive and accessibility quality

| Observation                                                                                | Improvement                                                                                                                             | Why it matters                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| At narrow widths, toolbar labels collapse while important scope information can disappear. | Keep one labeled primary run action, transaction status, and dirty state; move everything else into overflow.                           | Mobile/tablet users retain the core loop.                     |
| Editor and results compete for height in the split layout.                                 | Provide named layout presets (`Editor focus`, `Results focus`, `Balanced`) and remember the choice per tab.                             | Reduces repeated splitter manipulation.                       |
| Keyboard shortcuts are powerful but not discoverable.                                      | Keep the shortcuts popover grouped by editing, execution, navigation, and sharing; use the platform modifier consistently.              | Users can learn the workflow incrementally.                   |
| Inline actions and result tabs need stronger announcement semantics.                       | Add statement-aware accessible names, roving focus for result tabs, live announcements for completion/failure, and visible focus rings. | Keyboard and screen-reader users get the same scope feedback. |
| Large JSON values and wide result tables are hard to inspect.                              | Use a structured value viewer with copy path/value actions, column resize affordances, and horizontal scroll inside the result region.  | Preserves context while inspecting dense data.                |

### P2 — AI and surrounding-workspace integration

| Observation                                                                    | Improvement                                                                                                                             | Why it matters                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| AI actions sit near execution controls and can be mistaken for a run path.     | Keep `Draft with AI` and `Explain with AI` under an `AI` group with explicit “does not run SQL” copy.                                   | Maintains the safety boundary.                        |
| Opening AI from SQL should preserve the draft and return destination.          | Show a compact context chip in AI and a `Back to SQL draft` action that restores the exact editor/tab.                                  | Makes the round trip feel continuous.                 |
| Table context, schema scope, and sharing permissions are spread across panels. | Use one concise context receipt with table count, schema sharing, sample-row permission, and query-result permission; link to settings. | Users can answer “what will the AI see?” at a glance. |
| AI-generated SQL can be longer than the current editor viewport.               | Offer `Insert into editor`, `Replace draft` with confirmation, and `Open as new SQL tab`; never silently replace.                       | Keeps AI assistance reversible.                       |

### P3 — performance and operational polish

- Preserve cursor, selection, scroll position, and active result tab through resize,
  history navigation, fullscreen, and execution.
- Virtualize very large result sets and defer chart/JSON rendering until the
  selected presentation needs it.
- Add cancellation progress and a stable request identifier to query errors so
  users can report a failed execution precisely.
- Keep a small local execution timeline with duration, row count, affected-row
  count, and cancellation state, while allowing history retention to be disabled.
- Add visual regression coverage for the toolbar at 320/390/768/1024px and for
  light/dark themes, plus keyboard-only E2E for scope selection, save, reset,
  transaction controls, and result navigation.

## Remaining backlog implementation update

The remaining implementation pass completed the items that fit the current
client and connection contracts:

| Item                       | Current behavior                                                                                                                                                                                 | Status                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Named SQL tabs             | SQL tabs use the same rename affordance as table tabs and keep the title in URL/tab state. New SQL tabs start with a readable Custom SQL title.                                                  | Shipped                                                                             |
| Duplicate favorites        | Saving an SQL string that already exists shows the existing title and asks whether to save another copy. Cancelling leaves the library unchanged.                                                | Shipped; an Update existing editor remains a future library-management enhancement. |
| Schema-aware snippets      | The snippets menu exposes the active table and columns, includes a column sample, supports table, column, and parameter tokens, and inserts schema references at the editor cursor or selection. | Shipped                                                                             |
| Cursor/selection execution | Monaco has a Run current SQL statement context-menu action using the same selection/cursor scope as the toolbar and Ctrl/Cmd+Enter.                                                              | Shipped                                                                             |
| Result metadata            | Result tabs and the result receipt show returned/affected rows, duration, and statement number.                                                                                                  | Shipped                                                                             |
| Result comparison          | Multi-statement and single-statement results can be pinned as bounded browser-local snapshots; pinned results remain available after later executions and reloads.                               | Shipped with a five-result/500-row cap and explicit local snapshot labeling.        |
| Layout presets             | The editor maximize menu offers Editor focus, Balanced, and Results focus and applies them through the live splitter without remounting Monaco.                                                  | Shipped; covered by the retention E2E.                                              |
| Table origin receipt       | SQL opened from a table shows a compact Context: schema.table receipt beside the editor scope.                                                                                                   | Shipped                                                                             |
| Draft recovery             | Local drafts have an explicit restored-draft banner with Keep/Discard actions; clean reloads are distinguished from interrupted sessions, and competing shared/local drafts require a chooser.   | Shipped                                                                             |
| Persistent transactions    | Begin/Commit/Rollback are available for supported connections with ownership checks, serialized operations, idle rollback, and visible status.                                                   | Shipped with a deliberate one-process/15-minute TTL boundary                        |

## Reproducible app audit findings

The broad E2E pass was used as a bug-finding probe, and failures were rerun in
isolation before being treated as product defects. One actual connection UX bug
was confirmed and fixed:

| Finding                                                                                                                                                                                                                                   | Reproduction                                                                                                                                            | Fix and regression coverage                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When a PostgreSQL connection refused the connection, the empty workspace and table sidebar continued to show `Loading tables…` while dependent introspection requests retried. This made a failed connection look like a slow table load. | Open `e2e-unreachable-pg` and wait for the database refusal. The database error was visible while the empty workspace still rendered the loading state. | Dependent table/object queries are disabled when their database/schema prerequisite is unavailable, and both sidebar and empty workspace show a clear unavailable message. Covered by `Connection bootstrap smoke › Unreachable postgres fails with a driver connect error`. |

The following broad-run failures were not counted as product bugs after
isolated reruns: the AI fixture's direct SQLite insert hit a test-database lock;
the export test used the old pre-menu locator; the home connection assertion
selected a hidden mobile duplicate; and the row-editor failures passed when run
alone. Their E2E synchronization/locator fixes are kept separate from product
behavior. Vite's generic `Script error` and `ResizeObserver` development-server
messages were observed, but no corresponding user-visible failure or Playwright
`pageerror` was reproduced in the focused workflows.

The editor-reset regression remains a hard invariant: execution updates the
last-run identity while retaining the complete live editor draft. Resizing,
running a statement, running a script, and switching between table/custom SQL
contexts are covered by the focused E2E scenarios.

## Latest completion pass

- Cross-run result persistence stores only bounded result snapshots in browser
  storage; it does not silently upload or share result data.
- Execution receipts expose a short server-generated request ID, while the
  expanded timeline keeps success, error, and cancelled executions with timing
  and row metadata. Both surfaces remain local to the connection/tab.
- Custom SQL has tracked Playwright visual baselines for desktop, tablet, 390px,
  and 320px layouts. The toolbar/result controls wrap at narrow widths and the
  primary Run action remains reachable.

## Final UI/UX review after implementation

This is the current user-facing review of Custom SQL at desktop and narrow
widths, including the editor, result surface, history/favorites, transactions,
AI actions, and empty/error states. It treats visual hierarchy and
comprehension as first-class issues, not just missing controls.

### P0 — must remain protected

| Area                 | Review finding                                                                                    | Direction                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Draft integrity      | Execution must never replace the full editor content with the one statement that happened to run. | Keep the editor-retention E2E as a release gate; avoid effects keyed to result IDs or generated SQL.             |
| Execution scope      | A selection, cursor statement, full script, and atomic script have different consequences.        | Keep calculated scope adjacent to Run and use explicit Run all N / atomic labels.                                |
| Destructive SQL      | Confirmation needs the exact statement count and operation, not a generic prompt.                 | Include affected operation, connection, scope, and transaction mode; default focus should be Cancel.             |
| Transaction lifetime | A persistent transaction can outlive the visible panel but not the server process/TTL contract.   | Warn before leaving with an active transaction and display expiry/last activity when the backend can provide it. |

### P1 — highest-value comprehension improvements

| Area                      | What still feels difficult                                                                   | Recommended improvement                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Toolbar hierarchy         | Snippets, AI, transaction, tools, layout, favorite, and Run still compete in one row.        | Keep only scope + Run + one AI entry point visible. Group SQL tools, AI, and Layout in overflow.               |
| Draft/result relationship | A result can be older than the current draft, but the relationship is not immediate.         | Add Draft changed since last run beside the result receipt and a Run draft action.                             |
| Empty editor              | The blank state still asks a user to know SQL before showing a path forward.                 | Show one read-only example, Insert from schema, and Draft with AI in that order.                               |
| Result success states     | Zero returned rows, zero affected rows, cancelled work, and an empty table can look similar. | Give each a distinct status sentence and a next action.                                                        |
| Partial script failure    | Sequential execution can apply earlier statements before a later failure.                    | Keep a persistent banner with completed/failed statement indices and links to each statement.                  |
| Error recovery            | Error cards contain technical detail but not enough scope context.                           | Lead with a plain-language cause, show SQL/line context on demand, and retry only classified transient errors. |
| Active transactions       | Active status is another toolbar button.                                                     | Promote it to a compact banner with Commit/Rollback and a leave-page warning.                                  |

### P2 — reduce density and improve discoverability

| Area          | Improvement                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Header        | Collapse stable connection/dialect metadata into a subtitle; retain write-enabled/read-only status.                      |
| Scope         | Use a visible badge such as Selection, Statement 2 of 3, or Script with 3 statements.                                    |
| AI separation | Visually separate Draft/Explain with AI from execution and state that AI actions do not run SQL.                         |
| Snippets      | Add a first-use hint that snippets insert at the cursor; move snippet management to settings once custom editing exists. |
| Favorites     | Keep Save full script versus Save current statement explicit and show saved/unsaved state in editor chrome.              |
| History       | Distinguish Recent executions from Favorites with stronger labels, counts, and Open in editor.                           |
| Results       | Keep Table/Visualize as the persistent view switch; put copy/export, explain, and pin management in one result menu.     |
| Result tabs   | Put a short operation/table label before raw SQL and retain full SQL in a tooltip/details popover.                       |
| Filtering     | Explain that filtering is local to loaded rows and show N of M matches whenever active.                                  |
| Cell values   | Keep the inspector, adding copy path, value type, null state, and JSON/tree toggle for nested values.                    |
| Layout        | Add remembered Editor focus, Balanced, and Results focus presets instead of repeated splitter dragging.                  |

### P2 — responsive and accessibility review

| Area           | Improvement                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Narrow toolbar | At 320/390px preserve labeled Run, scope, dirty state, and transaction status; move everything else behind menus.                   |
| Narrow results | Independently scroll result controls so the whole page never gains accidental horizontal scrolling.                                 |
| Keyboard       | Add keyboard-only coverage for selection scope, context-menu execution, result navigation, pinning, reset, and transaction actions. |
| Screen readers | Announce execution started/completed/failed/cancelled and identify result tabs by statement plus status.                            |
| Focus          | Preserve focus when menus insert text, result tabs change, and recovery dialogs close.                                              |
| Contrast       | Verify warning, dirty, active, failed, and stale-result states in both themes.                                                      |
| Touch          | Give splitter, close buttons, result-tab actions, and inline statement actions touch-safe hit areas.                                |

### P3 — performance and operational polish

- Keep cursor, selection, editor scroll, active result tab, and result filter stable
  through execution, resize, history navigation, and fullscreen transitions.
- Virtualize very large result sets and defer chart/JSON work until selected.
- Add request IDs and cancellation progress to execution errors so failures are
  reportable and distinguishable from stale UI state. **Implemented:** stored and
  direct custom SQL responses now include server-generated request IDs, and the
  result receipt exposes a short ID with the full value on hover.
- Consider a local execution timeline with opt-out retention, duration, returned
  rows, affected rows, and cancellation state. **Implemented:** a collapsed,
  browser-local timeline keeps the latest 30 success/error/cancelled entries and
  can be cleared from the result surface.
- Add visual regression snapshots for 320/390/768/1024px in light/dark themes.
  **Started:** tracked desktop and 390px baselines cover the custom SQL workspace;
  320/768/1024 and theme matrix remain follow-up coverage.
- Persist pinned results across executions only after a durable comparison model
  and retention/privacy semantics are agreed. **Implemented:** users can pin
  current results, snapshots are capped and browser-local, and pinned results
  survive subsequent runs and reloads. The UI labels them as local pinned
  snapshots rather than implying live database data.

### Recommended next product sequence

1. Simplify the toolbar and promote scope, dirty state, stale-result state, and
   active-transaction state.
2. Add result/error/partial-failure status and keyboard/accessibility
   announcements.
3. Add responsive visual regression coverage and layout presets.
4. Add richer timeline filters and comparison tooling if users need more than
   the shipped local pins/timeline; keep retention browser-local until a shared
   product contract exists.
5. For deployment beyond one server process, move transaction sessions to an
   affinity-backed or shared transaction service before removing the TTL boundary.
