# Tables sidebar + AI sidebar UI/UX review

Status: **review complete**  
Date: 2026-08-28

## Review brief

This is a user-facing review of the connection workspace's tables sidebar,
tabs bar, and AI sidechat/full-chat surfaces. It focuses on the feeling that
there is too much happening at once: multiple navigation layers, several
competing action rows, and a contextual AI panel that can cover the workspace.

The review used the local SQLite fixture at desktop width in both dark and
light themes, including an empty workspace, an open `users` table, and the AI
sidechat. The rendered fixture had a 245px tables rail and a 480px AI sidechat
at a 1280px viewport. No production connections or provider credentials were
used.

## Executive conclusion

The individual controls are mostly understandable. The overload comes from
composition rather than one broken widget:

```text
global app rail → connection/tables rail → workspace tab strip → table toolbar
                                      ↘ AI sidechat overlay
```

Each layer is reasonable on its own, but together they expose too many
navigation surfaces and too many simultaneous states. The highest-leverage
change is to establish one clear workspace hierarchy:

1. **Where am I?** connection and current table/chat.
2. **What can I switch to?** tables, saved tabs, or chats.
3. **What can I do here?** the small set of actions for the current surface.

Everything else should be collapsed, moved into an overflow menu, or shown
only when the relevant object/state exists.

## What is working well

### Tables sidebar

- The table list is virtualized and remains usable with large schemas.
- The current table has a visible selected state.
- Table filtering is URL-backed, so shared workspace state can be restored.
- The sidebar has a separate database-value search instead of forcing users to
  scan the table list for data.
- Objects are already progressively disclosed behind a collapsed section.
- Hover prefetching makes table opening feel responsive.
- Table context menus provide a power-user path without permanently adding
  buttons to every row.

### AI sidechat and full chat

- Sidechat placement is a persisted left/right preference.
- Sidechat and the AI tab share the same conversation/context model.
- The sidechat header has a stable close target and a direct full-chat escape
  hatch.
- Context can be inspected, added, and removed before sending.
- Provider setup and data-sharing consent are explicit rather than implicit.
- Disabled actions now have a reason, and blocked starter prompts are hidden
  instead of presenting a wall of inactive buttons.
- Full chat has a dedicated thread rail, loading states, and recovery actions.
- Chat history loading warns when malformed persisted messages are skipped.

## Priority model

- **P0**: causes users to lose orientation, data, or a primary workflow.
- **P1**: materially increases confusion or blocks task completion.
- **P2**: recurring friction and density that should be cleaned up.
- **P3**: polish, discoverability, or lower-frequency optimization.

## Tables sidebar findings

| Priority | Finding / user impact                                                                                                                                                                                                              | Recommended change                                                                                                                                                                                 | Acceptance criteria                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P1       | There are three persistent navigation layers before the data itself: global app rail, connection tables rail, and workspace tabs. Users can lose track of whether they are switching a table, a tab, or a whole product area.      | Give the connection rail one explicit job: **browse and switch tables**. Visually subordinate the global rail and make the tabs strip the current-workspace history, not a second table navigator. | A first-time user can identify the current connection, current table, and table-switching control without reading every icon. |
| P1       | The sidebar header spends space on the connection name and a database search icon, while the table list itself has a separate heading and schema/database controls. The relationship between these controls is not obvious.        | Group connection-level actions into a compact header menu and reserve the visible header for connection identity plus one primary search action.                                                   | Connection-level actions are discoverable from one place and the tables section starts higher without losing capability.      |
| P1       | A long flat table list is difficult to scan when names are similar or generated. Search is necessary, but users have no visible recent/favorite/pinned grouping in the persistent sidebar.                                         | Add small **Recent** and **Pinned** groups above the full list, with a clear “All tables” section. Keep the full list virtualized.                                                                 | A user who opened a table recently can return to it in one click; the full list remains available without visual clutter.     |
| P1       | Database/schema selectors appear only for some dialects and are separated vertically from the table list. When the active schema changes, the table list changes substantially but there is no strong transition cue.              | Treat database/schema as a single **Scope** control with a short current-value summary and announce the table-list refresh.                                                                        | Users understand why the list changed and can see the active scope without searching above the fold.                          |
| P1       | The selected table is primarily communicated by a muted background. In a dense list, this can be missed, especially with dark theme contrast or long names.                                                                        | Add a compact leading selected marker or table icon plus a stronger selected-state contrast. Keep the text readable in both themes.                                                                | The active table is identifiable at a glance without relying on color alone.                                                  |
| P1       | Table selection, double-click opening, context-menu opening, and tab creation expose multiple interaction models. This increases the chance that a user accidentally creates duplicate tabs or does not know what a click will do. | Define one primary row action—single click opens/activates—and move alternate actions into the row menu. If double-click remains, make it edit/rename or remove it.                                | One click has one predictable result; opening a duplicate is always an explicit menu action.                                  |
| P2       | The “Objects” section is correctly collapsed, but “None” is a low-value status that competes with the table count and makes the sidebar feel more instrument-like than task-oriented.                                              | Show the object section only when objects exist, or use a quiet “Show objects” disclosure without a `None` badge.                                                                                  | Empty object metadata does not compete with table navigation.                                                                 |
| P2       | The filter field has no obvious clear affordance and the list header does not explain whether the count is total tables or filtered tables.                                                                                        | Add a clear button when text exists and label the count as `6 tables` / `2 matching` depending on state.                                                                                           | Users can clear a filter in one click and understand exactly what the count represents.                                       |
| P2       | Search/filter state is URL-backed, which is good for sharing, but persistence can also make a newly opened connection look mysteriously empty when an old filter remains.                                                          | Show an inline active-filter chip or a “Clear filter” action whenever the URL contains a filter.                                                                                                   | A user never has to infer that an empty list is caused by a hidden persisted filter.                                          |
| P2       | Table rows are text-only and visually repetitive. Schema information is hidden unless multiple schemas are present, so similarly named tables can be ambiguous.                                                                    | Show schema as a secondary label when the connection has multiple scopes, and use a restrained table glyph or type indicator.                                                                      | Same-named tables can be distinguished without opening them.                                                                  |
| P2       | The right-click context menu is powerful but discoverability is weak, particularly for touchpads and keyboard users.                                                                                                               | Add an overflow trigger on the focused/hovered row, while keeping the context menu as an alternate entry point.                                                                                    | Rename, duplicate/open, copy link, and related actions are available without a right-click gesture.                           |
| P2       | Loading, error, and empty states occupy different visual shapes and do not share one stable section header. The table list can feel like it moved when the query state changes.                                                    | Keep the Tables header/search shell mounted and swap only the list body for loading/error/empty content.                                                                                           | The user retains orientation while tables load, fail, or produce no matches.                                                  |
| P2       | On narrow screens, the tables sidebar and the AI sidechat compete for the same limited width. Opening one can obscure the other rather than establishing a clear modal layer.                                                      | Define an explicit mobile priority: table browser becomes a sheet, AI becomes a sheet, and opening one closes or backgrounds the other with a clear return path.                                   | There is never more than one opaque narrow-screen navigation surface above the workspace.                                     |
| P3       | The sidebar does not show table metadata that would help prioritization, such as row count, favorite state, or last opened time.                                                                                                   | Add metadata only to Recent/Pinned rows or on hover; do not put a stats column on every table.                                                                                                     | Useful metadata improves returning to known tables without making the all-tables list denser.                                 |
| P3       | The Schema Explorer button is visually similar to an action for the current table, even though it changes the user's mental model to database structure.                                                                           | Use a labeled secondary menu item or place it under Scope/Explore.                                                                                                                                 | Users can predict whether a control opens a table, a schema browser, or a diagram.                                            |

## AI sidechat findings

| Priority | Finding / user impact                                                                                                                                                                                                                 | Recommended change                                                                                                                                                                                                 | Acceptance criteria                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| P1       | Even after simplification, the sidechat stacks context, provider setup, current-chat controls, message viewport, composer, permission summary, and schema scope. The user must understand several systems before asking one question. | Make the default sidechat a focused **ask surface**: context summary, one setup/consent card when needed, conversation, composer. Move schema mode, tool permissions, and detailed sharing into settings only.     | A new user sees one primary next action and no more than one secondary explanation before the composer.                   |
| P1       | The “Needs setup” header badge, “Connect an AI provider” card, disabled Send reason, and disabled composer all communicate overlapping setup state. Repetition makes the panel feel broken.                                           | Keep the badge for scanability and the card for action. Hide the Send reason when the card is visible, or replace it with a single concise status line.                                                            | Setup state is communicated once as a primary instruction and once as a compact status, never four times.                 |
| P1       | The sidechat is 480px wide at a 1280px viewport and visually covers a large portion of the table. This is useful for reading, but expensive when the user only wants to ask a quick question.                                         | Use a narrower default rail around 380–420px with an intentional resize handle; allow the full chat tab to own wide reading.                                                                                       | The current table remains meaningfully visible while the sidechat is open, and long content remains scrollable.           |
| P1       | The empty message viewport is mostly blank. When blocked, that blankness looks like a failed load; when ready, several suggested actions compete with the actual composer.                                                            | Use one contextual prompt plus at most two starter actions. When blocked, show a short reason inside the setup card and keep the viewport quiet.                                                                   | Empty, blocked, ready, loading, and failed states are visually distinct and each has one obvious next action.             |
| P1       | Context is described with several overlapping terms: attachment, metadata, values, chat, next message, and this turn. Users can still wonder what persists and what is sent.                                                          | Use a stable three-part vocabulary: **Saved in this browser**, **Attached to this chat**, **Included in the next message**. Add one expandable “What is shared?” detail.                                           | A user can answer what will be sent now, what survives reload, and what removal affects without opening settings.         |
| P1       | “Add tables” is useful but behaves like a picker hidden inside a card. It does not show how many tables are selected, whether a table is already attached, or whether the add action is per-message or persistent.                    | Show `Add tables · N selected`, selected checkmarks, and an explicit scope label. Consider keeping the popover open for multi-add with a Done action.                                                              | Adding two or more tables does not require repeatedly reopening the picker, and the resulting scope is obvious.           |
| P1       | Sidechat-to-full-chat handoff preserves completed state, but an in-flight generation still belongs to the old runtime. A route transition at that moment can make the response appear to stop or lag.                                 | Either keep the runtime alive through promotion or defer promotion until the active generation finishes, with a visible “Opening when complete” state. Apply the same protection to close/dismiss while streaming. | Starting a handoff during generation never drops the visible draft, user message, assistant partial response, or context. |
| P2       | The current-chat row and composer-level New chat action duplicate each other. In a narrow rail, the repeated action adds noise.                                                                                                       | Keep New chat in the current-chat row and reserve the composer action row for Send plus More.                                                                                                                      | There is one obvious New chat control in sidechat and one in full chat, not two in the same surface.                      |
| P2       | The provider setup card uses a large bordered treatment that visually competes with the context card, even though setup is a prerequisite rather than current data context.                                                           | Use a compact inline setup callout with one primary button and a smaller trust note. Reserve large cards for data/context that users inspect.                                                                      | Context remains the first visual anchor; provider setup is actionable without dominating the panel.                       |
| P2       | The composer can contain seeded text such as `Explore the `task` table:`. If the provider is not configured, the user sees editable-looking content that cannot be sent.                                                              | Treat seeded text as a starter chip or label until setup is ready; when ready, focus the composer and make the draft clearly editable.                                                                             | Disabled setup does not look like an unfinished user draft.                                                               |
| P2       | Settings mode is bounded, but it still exposes provider, tools, schema, placement, and data access as one long settings stack. The user can lose the conversation's context while configuring.                                        | Use a two-level settings model: a short settings index/summary, then one focused section at a time. Keep a persistent “Back to chat” affordance.                                                                   | A user can change one setting and return to the exact conversation scroll position.                                       |
| P2       | The sidechat header has icon-only settings and close controls, which is compact, but the connection name and status badge can still compete at narrow widths.                                                                         | Allow the title to truncate with a tooltip and keep a consistent control order: full chat, settings, close. Hide non-essential badge text below the smallest breakpoint.                                           | Header controls remain reachable and unambiguous at 320px and 390px widths.                                               |
| P2       | Permission summary, setup copy, and context data-class labels all explain privacy. Accurate repetition increases cognitive load.                                                                                                      | Keep one compact privacy receipt near the composer and link to detailed sharing settings.                                                                                                                          | Privacy is always visible but can be understood in one scan.                                                              |
| P2       | The sidechat does not provide a lightweight way to see the active conversation title beyond the current-chat row, and it intentionally hides history. This is fine for focus but weak for continuity.                                 | Make the current-chat label a compact menu with New chat and Open full chat, without introducing a second thread list.                                                                                             | Users can confirm which conversation they are in and start fresh without opening full chat.                               |
| P2       | Error, loading, generation, approval, and cancellation states use different inline positions. The user may scan the wrong region for status.                                                                                          | Reserve one status slot directly under the current-chat row and use it consistently for non-idle states.                                                                                                           | Every non-idle state appears in the same predictable place with one recovery action.                                      |
| P2       | The sidechat is a dialog and focus trap, but the implementation relies on document-level selectors. Future nested surfaces could make focus target the wrong control.                                                                 | Scope focus management to the mounted dialog ref and use the invoking element as the restoration target.                                                                                                           | Opening/closing nested menus, settings, and table pickers never loses keyboard focus.                                     |
| P3       | Sidechat placement is discoverable only after opening settings. Users may not know why it appeared on one side.                                                                                                                       | Add a first-use tooltip or a small “Move sidechat in Settings” hint, then retire it.                                                                                                                               | Users can find the preference without making the main header busier.                                                      |
| P3       | Copy/export feedback is brief and primarily announced to assistive technology. Sighted users may not notice what happened.                                                                                                            | Keep the temporary Copied state and add a subtle menu-item checkmark/toast only when needed.                                                                                                                       | Copy confirmation is visible without changing layout or creating notification noise.                                      |

## Full AI tab findings

| Priority | Finding / user impact                                                                                                                                                                                                            | Recommended change                                                                                                                                                        | Acceptance criteria                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| P1       | Full chat introduces another header, thread rail, sharing panel, current-chat row, message viewport, and composer. It is the correct deep-work mode, but its first screen still has a lot of chrome before conversation content. | Establish a clear full-chat layout: compact header, optional thread rail, one context/privacy strip, then conversation. Move setup/settings into a focused mode or modal. | A returning user reaches the active conversation without scrolling past configuration UI.             |
| P1       | The thread rail is wider now, but it still combines search, recency groups, title selection, and hover actions in a small area. Long titles and action icons compete.                                                            | Give each row one title/recency line and put pin/rename/delete in one overflow menu. Keep the active row visually strong.                                                 | Thread selection is easy; row management is available without permanently reserving three icon slots. |
| P1       | Thread loading and active conversation loading are separate concepts. A list can appear ready while the selected conversation is still blank.                                                                                    | Keep list loading, active-thread loading, and history-warning states separate in the UI, with a skeleton/status row in the message viewport.                              | Selecting a previous chat never looks like an empty new chat while it is loading.                     |
| P2       | The full page and sidechat use similar context/privacy language but different layouts. Switching surfaces forces the user to relearn the same state.                                                                             | Share one context receipt component and vary only the amount of detail.                                                                                                   | Context chips, data classes, and persistence labels mean the same thing everywhere.                   |
| P2       | The full-page composer has Send, New chat, More, model controls, privacy status, schema status, and token count. The action hierarchy is hard to scan on a small window.                                                         | Keep Send primary, put model/export/new-chat under a single secondary action cluster, and show token usage only when expanded or non-zero.                                | The composer action row has one primary action and no more than two secondary affordances.            |
| P2       | A full chat opened from a table can retain context, but the source table is not always prominent once the message history grows.                                                                                                 | Keep a compact sticky context receipt with the source table and attachment count; allow it to collapse.                                                                   | Users can identify the data scope without scrolling to the first message.                             |
| P2       | Back navigation, tabs URL state, and thread URL state are powerful but invisible. A user can be unsure whether Back returns to the previous table or exits the connection.                                                       | Add a short connection-level back label and preserve the existing URL state; avoid introducing another breadcrumb row.                                                    | Back behavior is predictable from the header and sibling tabs remain intact.                          |
| P2       | Full-chat empty states can still feel too open-ended when there is no table context.                                                                                                                                             | Use a neutral database starter set and explain how to attach a table from the context strip, rather than choosing an arbitrary first table.                               | No-context chats never imply that an unrelated table is active.                                       |
| P3       | Thread search is title-only, which is fast but limits retrieval when titles are generic.                                                                                                                                         | Later, index table names and first user-message text while preserving title-first ranking.                                                                                | Search can find a chat by its table or question without making list rendering heavier.                |

## Cross-surface recommendations

### 1. Adopt a “one primary surface” rule

At any moment, one thing should be visually primary:

- table browsing when the tables rail is being used;
- table data when a table tab is active;
- asking when sidechat is open;
- conversation/history when full chat is active.

The other surfaces should become quieter, not disappear unpredictably.

### 2. Use progressive disclosure as the default density strategy

Keep visible:

- current identity;
- one search/switch action;
- one primary action;
- current status;
- current context.

Move configuration, destructive actions, metadata, and advanced schema/tool
controls behind one clearly labelled disclosure or overflow menu.

### 3. Make state readable without repeating it

Use one consistent receipt for:

- current connection/table;
- attached tables/selection/results;
- metadata versus row values;
- saved-in-browser versus attached-to-chat versus included-next-message.

This will reduce the repeated explanatory copy that currently contributes to
the feeling of complexity.

### 4. Establish narrow-screen rules

At 320–639px:

- only one of the tables sheet, AI sidechat, or thread drawer should be open;
- sidechat should use a sheet width/height that leaves a visible dismissal
  affordance;
- the composer should remain above the virtual keyboard;
- long labels should truncate with accessible full text;
- advanced controls should be menu items, not rows of buttons.

At desktop widths:

- retain the resizable tables rail;
- keep sidechat around 380–420px by default;
- let full chat own the wide reading layout;
- make the current surface visually stronger than the surrounding chrome.

## Suggested next build order

1. Implement the shared context/privacy receipt and remove duplicated setup
   explanations.
2. Consolidate tables sidebar scope/search/recent controls and add explicit
   row action menus.
3. Reduce sidechat default width and simplify its empty/blocked/ready states.
4. Make mobile sheets mutually exclusive and verify keyboard/focus behavior.
5. Add safe in-flight stream handoff or a visible deferred-promotion state.
6. Run the 320/390/768/1024px light/dark and VoiceOver QA matrix.

## Explicit non-goals

- Do not remove the tables sidebar or the AI sidechat; both are useful when
  their jobs are distinct.
- Do not turn the sidechat into a second full thread-management surface.
- Do not hide data-sharing consent or broaden provider access for the sake of a
  cleaner screenshot.
- Do not add table metadata to every row if it makes the core list denser.
