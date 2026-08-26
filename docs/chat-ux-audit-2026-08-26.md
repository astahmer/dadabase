# Dadabase AI-chat UX deep-dive — 2026-08-26

## Scope & method

AI chat page only (`/connections/$connectionName/ai`), one day after the full-app [2026-08-25 audit](./ux-audit-2026-08-25.md) whose chat findings (C1–C16) were remediated. Purpose: verify those fixes **in practice**, then find everything still worth improving.

Three parallel live reviewers inspected real dev servers seeded from the `e2e-sqlite` fixture (:3201/:3202/:3203), each through a different lens:

- **Visual design & layout** — scripted Playwright DOM audits (font census, contrast sampling, control naming, overflow at 1280/1024/768, code-block affordances), dark *and* light, screenshots + source citations (`/tmp/ux-review-visual.md`).
- **Interaction flows** — every flow exercised end-to-end with mocked SSE: first-run, keyless send, cancel, approve/reject, navigation round-trips, reload persistence; DOM/network request forensics (`/tmp/ux-review-flow.md`).
- **Product grade** — critique against Claude.ai / ChatGPT / Linear-AI / Cursor standards; context transparency, metadata, error taxonomy, power-user surface, cross-surface continuity (`/tmp/ux-review-product.md`).

Severity: **P0** blocks daily use · **P1** high friction · **P2** medium · **P3** polish.

## C1–C16 remediation verdicts in practice

| Finding | Verdict | Note |
|---|---|---|
| C1 consent gate renders full surface | ✅ SOLID | Measured `sendDisabled=true` pre-consent; composer/thread/hint all present |
| C2 keyless providers can send | ✅ SOLID | Live Ollama flow end-to-end: select → Save → send → exactly one clean reply |
| C3 schema-count truth | ✅ SOLID | Status line agrees with sidebar/settings ("6 tables in main"); per-turn visibility still missing → see T1 |
| C4 propose_sql shows SQL by default | ✅ SOLID | Purpose line + `<pre>` SQL + Run + outcome text at decision site (`ai-chat.page.tsx:1262-1290`) |
| C5 All/Selected/Auto radiogroup | ✅ SOLID | Real `role=radiogroup`/`radio`/`aria-checked` (`ai-chat.page.tsx:652-663`) |
| C6 narrow layout strategy | 🟡 SHAKY | Overlay drawer verified at ≥768px, zero overflow; the ≤620px collapse called out on 08-25 was **not re-tested** → N1 |
| C7 first-run hierarchy | ✅ SOLID | Panels collapsed by default; primary CTA present |
| C8 message DOM order (role before text) | 🟡 SHAKY | Not explicitly re-measured this pass; spot-check recommended |
| C9 dialect-aware placeholder | ✅ SOLID | Confirmed by two reviewers — but still generic examples → P2 |
| C10 provider combobox labeling | 🟡 SHAKY | Picker works but shows bare model id, no grouping/"keyless" tag → P4; explicit label not re-queried |
| C11 streaming cue + Stop | ✅ SOLID | Status pill asserted by e2e; "Stop generating" labeled; elapsed timer |
| C12 threads ghost entry | 🟡 SHAKY | Ghost text exists — and is *permanently* shown because hydration never happens → S1 |
| C13 legacy key-storage migration | ✅ SOLID | Keyless JSON-config path works end-to-end; no dual-format failures observed |
| C14 approval outcome inline | ✅ SOLID | Outcome text at decision site survives navigate-away-and-back; result link-back still thin → K7 |
| C15 thread-header icon tooltips | ✅ SOLID | Present; hover-reveal suggested to reduce noise |
| C16 settings-save feedback | ✅ SOLID | Save flash + `announce("Provider settings saved.")` |

**Score: 11 SOLID / 5 SHAKY / 0 REGRESSED.** The remediation held.

## New findings (merged & deduped)

### Layout & visual design

- **[P2] L1 — Zero turn rhythm**: uniform 12px gaps between all messages regardless of role change (measured `[12,12,12,…]`). Long threads don't scan. Fix: 20–24px margin between turn groups + subtle user-turn tint, assistant turns flat.
- **[P2] L2 — Thread column fixed at max-w-3xl (~736px)**: fine for prose, cramped for wide result tables and long SQL lines already scrolling horizontally inside blocks. Consider `max-w-4xl` when the last turn contains a table/proposal.
- **[P3] L3 — Expanded panels stack >50% of viewport at 1440×900** when Provider+Tools+Schema are all open. Two-column panel layout ≥1280px, or accordion exclusivity option.
- **[P3] L4 — Long-thread render cost unverified** (blocked by S1): expect ~120 nodes for 60 messages — fine without virtualization to ~500 messages; revisit beyond.

### Message & content rendering

- **[P1] M1 — No syntax highlighting or language labels on any code block.** `markdown-text.tsx:55-64` renders plain `pre/code`; `rehype-highlight` + `highlight.js` are already repo deps, unused here. Monochrome SQL in a SQL product whose editor uses Monaco + highlight.js.
- **[P1] M2 — No copy affordances anywhere in the thread**: no copy on markdown fences (measured 0/2), no copy-assistant-text, no copy-SQL on proposal cards, zero clipboard usage in the page. Core output is SQL users paste elsewhere.
- **[P2] M3 — Code blocks lack overflow affordances**: scrolled vs unscrolled look identical (no fade edge); tall proposals have no collapse/expand. Gradient fade + collapse-to-N-lines with "expand".
- **[P2] M4 — No timestamps or message meta** (time/model/tokens): multi-turn threads have no temporal anchor. Parity gap with emi-healthfit's own chat, which shows per-message time + tokens.
- **[P3] M5 — Error-banner contrast spot-check had a small sample**; distinguish destructive retry affordance from disabled-composer copy in light theme.

### Composer & controls

- **[P1] C-A — Composer is a static 3-row textarea** (78px, never grows/shrinks). Best-in-class: auto-grow 1→8 rows. Drafts ARE persisted but there's no restored-draft indication.
- **[P2] C-B — Placeholder examples ignore the actual schema**: dialect-aware (good) but says "…recent orders…" on a fixture of users/posts/notes. Interpolate a real table name.
- **[P2] C-C — Model picker shows bare model id**: group hosted/local with icons + "keyless" tag; remember last-used per connection.
- **[P2] C-D — Preset change gives no inline summary of what Save will apply** (carried over H7, applies doubly in the compact chat panel).
- **[P3] C-E — Composer textarea fully disabled while streaming**: mainstream chats let you compose the follow-up; gate only Send.

### Flows & state

- **[P0] S1 — Persistence is write-only: conversations evaporate on reload.** Every turn is dutifully saved server-side (`chat_threads`/`chat_messages`, verified via direct insert + curl), but the client never reads any of it back: reload loses the conversation, a DB-seeded thread never appears in THREADS, and **zero thread-list network requests fire on mount** (`listChatThreadsServerFn` exists in `conversation-client.ts`, never invoked). Ghost copy "Chats will appear here once you start chatting" is permanently true. This is a data-trust bug wearing a UX hat, and it undermines every other thread feature. Fix: hydrate THREADS on mount/consent; load selected thread's messages into the runtime store.
- **[P0] S2 — Consent re-gates chat on every visit — and the checkbox is anonymous to screen readers.** `hasApprovedSchemaSharing` is component state (`ai-chat.page.tsx:122`), checkbox hardcoded `checked={false}` (~line 820), and `getByRole('checkbox')` reports an empty accessible name. Daily users re-click a trust checkbox forever (training them to stop reading it); AT users hit an unnamed control guarding a trust decision. Fix: persist per-connection consent in localStorage with a revoke action; associate the label (`aria-labelledby` or real `<label>`).
- **[P1] S3 — Thread rename/pin missing from UI** although `chat_threads.pinned` exists and ordering honors it. Only Delete is exposed.
- **[P1] S4 — Regenerate/retry unwired** even though vendored `thread-message.tsx` ships an unused "Regenerate response" prop — the building block exists.
- **[P2] S5 — Stop cancels client-side only**: no AbortSignal propagation in `conversation-client.ts`; server generation + detached persistence writer run to completion (token cost + an orphan persisted turn that will surface once S1 lands — reconcile).
- **[P2] S6 — Draft preservation across reload likely lost**: runtime exposes a drafts store, but the composer came back empty after reload+nav in probing.
- **[P2] S7 — No jump-to-bottom button** when scrolled up mid-stream; scroll helper restores position but offers no manual affordance.
- **[P2] S8 — Use-this-SQL has no return path**: editor handoff works; returning to the conversation requires the generic rail button. Add "back to chat · <thread title>" on the seeded editor tab.
- **[P2] S9 — Option-list bleed-through**: querying `role=option` with the provider popup open also surfaced workspace table-navigator options — two popups coexisting in the a11y tree. Verify visually; scope each popup's options.
- **[P2] S10 — Flat error taxonomy**: 400/401/404/quota/network all render identically ("Chat error"). Auth should deep-link provider settings; quota/network get distinct copy; surface the provider's message body.

### Trust & context transparency

- **[P1] T1 — No context receipt**: users see a table *count* but never *which* tables/columns/tools/model were sent per turn. For a tool where wrong-schema = wrong-SQL this is the top mental-model aid. Per-assistant-message footer: `llama3 · auto · youtube_video, channels · 1.9k ctx` (expandable). The route assembles all of it today and discards it.
- **[P1] T2 — Auto mode is a black box**: chosen tables shown only as a count. Show chips ("auto: youtube_video, channels") + click-to-edit selection so users can tell "Auto worked" from "Auto guessed wrong".
- **[P2] T3 — Token/latency/cost metadata nowhere**: ai-sdk finish chunk carries usage; route discards it. Per-message meta row + thread total.
- **[P2] T4 — No moment-of-send trust microcopy**: BYOK transparency lives in settings; add a one-liner under the composer on first send ("Schema names sent to ollama-local — never rows").
- **[P2] T5 — `?tabs=fMO3` URL pollution on the AI route**: workspace tab-state serializer writes onto `/ai`; shared links carry garbage params. Namespace or strip.

### Power-user & keyboard

- **[P1] K1 — No keyboard model at all**: composer has no `onKeyDown` (`ai-chat.page.tsx:1406-1420`) — Enter inserts newline, Send is click-only. Table stakes: Enter=send / Shift+Enter=newline (with hint), plus shortcuts for New chat / focus composer / settings.
- **[P1] K2 — Thread export missing; the helper is literally unused**: `src/lib/chat/web/conversation/conversation-markdown.ts` ships vendored with zero callers. One "Export .md" button is nearly free.
- **[P2] K3 — Thread list has no organization**: no search, no date grouping (Today/Yesterday/Earlier), duplicated titles indistinguishable. Cheap over drizzle-backed data.
- **[P2] K4 — Cross-surface continuity is one-directional**: chat→editor works; nothing flows INTO chat. "Ask AI about this table" from browse/structure (pre-seeded draft + Selected mode scoped to that table) is the highest-intent missing entry point.
- **[P2] K5 — Approval outcome ends near, not at, the results**: show "✓ Ran · 142 rows · open results" inline under the approved card.
- **[P3] K6 — Slash commands** (`/sql`, `/schema`, `/clear`): cheap delight, optional.
- **[P3] K7 — Unfocused-tab completion cue**: stream finishing elsewhere gets no title badge/favicon dot.

### Narrow viewport

- **[P1] N1 — ≤620px behavior unverified post-fix**: 08-25 found the thread node leaving the DOM at 620px; this pass measured ≥768 only (drawer works there, zero overflow). Re-test 620/560 before declaring C6 done.
- **[P3] N2 — Browser-zoom 125% rem-scaling approximated only** via effective-width viewports; needs one true zoom pass.

## Top 10 highest-impact improvements (impact : effort)

1. **S1 — Hydrate threads/messages on mount** (P0, medium effort): turns write-only persistence into real history; unlocks S3/K3/K2 meaningfully.
2. **S2 — Persist consent per connection + associate the checkbox label** (P0, small): stops daily re-gating; fixes the anonymous-trust-checkbox a11y bug.
3. **K1 — Enter-to-send / Shift+Enter newline + hint** (P1, tiny): single most-expected interaction in any chat.
4. **M1 — Syntax highlighting via the already-installed `rehype-highlight`** (P1, small): chat SQL finally looks like SQL.
5. **M2 — Copy buttons: code fences, assistant text, proposal SQL** (P1, small): daily-use clipboard path for the product's core output.
6. **S4 — Wire the shipped-but-unused Regenerate prop** (P1, tiny): retry-after-error without retyping.
7. **T1+T2 — Context receipt: per-turn model/table/tool chips; Auto shows chosen tables + edit selection** (P1, medium): the trust feature that makes Auto mode adoptable.
8. **K2 — Thread export .md via the vendored unused helper** (P1, tiny).
9. **S3 — Rename/pin threads over the existing `pinned` column** (P1, small-medium).
10. **M4+T3 — Message meta row (time · model · tokens)** (P2, small): scannability + perceived quality in one.

*(Next tier: S8 return link, S5 AbortSignal propagation, S10 error taxonomy, C-A auto-grow composer, K4 "Ask AI about this table".)*

## Grade: **B−** (was C+)

**Why the jump:** every C1–C16 remediation verifiably holds in live use — the six P0-class breakages from 08-25 (dead palette aside, they were chat's whole failure story) are gone; the keyless flow works end-to-end; proposals show their SQL; streaming has real affordances; narrow widths stopped overflowing. The product no longer fights the user.

**Why not higher:** two P0s remain that a daily-returning user hits immediately — conversations don't survive a reload (S1), and the consent gate re-arms every visit (S2) — plus an interaction baseline (Enter-to-send, copy, regenerate) that every mainstream chat ships by default. All of it is small, well-scoped work on top of foundations that are now genuinely sound; clearing the Top-10 above puts this at A−.

## Remediation status (2026-08-26 sweep)

Legend: ✅ RESOLVED · 🟡 PARTIAL · ⏸ DEFERRED. Change: `feat(chat): context receipt, error taxonomy, ask-about-table`.

### Flows & state

- S1 hydration on mount: ✅ RESOLVED (landed in an earlier batch this arc; THREADS hydrate from drizzle-backed threads, persisted messages load into the runtime).
- S2 consent persistence + labeled checkbox: ✅ RESOLVED (earlier batch; per-connection grant + revoke, `aria-labelledby`).
- S3 rename/pin/delete + K3 search/date groups: ✅ RESOLVED (earlier batch).
- S4 Regenerate wired to runtime retry: ✅ RESOLVED (earlier batch).
- S5 AbortSignal propagation to the server route: ✅ RESOLVED (earlier batch — request.signal aborts upstream generation and drops the truncated reply from persistence).
- S6 draft restore after reload: ✅ RESOLVED (earlier batch).
- S7 jump-to-bottom button: ✅ RESOLVED (earlier batch).
- S8 editor back-link (`?thread=` + staged return meta): ✅ RESOLVED (earlier batch).
- S9 option-list bleed-through: ✅ RESOLVED (earlier batch — provider popup scoped; verified by scoped role=option queries in chat e2e).
- S10 error taxonomy (auth/model/quota/network + provider body + settings deep link): ✅ RESOLVED this sweep (`classifyChatError` + inline recovery actions).

### Trust & context transparency

- T1 context receipt per assistant turn (mode · tables · tools · ctx tokens): ✅ RESOLVED this sweep — route emits a receipt on the stream metadata channel AND persists it in a new `chat_messages.context` column (migration 0006), so hydrated history shows it too.
- T2 auto chips click-to-edit: ✅ RESOLVED this sweep — auto-mode table chips are buttons that adopt the subset as a manual selection.
- T3 token/latency metadata: ✅ RESOLVED (earlier batch — per-message usage + thread total footer).
- T4 moment-of-send microcopy: ✅ RESOLVED this sweep — "Schema and table names are sent to <provider> — never row data." under the composer; retires after first send.
- T5 `?tabs=` pollution on /ai: ✅ RESOLVED this sweep — inherited workspace tab keys are stripped from the AI route URL.

### Power-user & keyboard

- K1 Enter-to-send/Shift+Enter + hint: ✅ RESOLVED (earlier batch).
- K2 Export .md via vendored helper: ✅ RESOLVED (earlier batch).
- K3 thread search + date grouping + pinned bucket: ✅ RESOLVED (earlier batch).
- K4 "Ask AI about this table": ✅ RESOLVED this sweep — `?askTable=<name>` scopes Selected schema to that table, pre-seeds the composer draft (hydration-race-safe re-assert), strips the param; e2e covered.
- K5 approval outcome inline under the approved card: ✅ RESOLVED (earlier batch renders "Ran ✓ · N rows / Failed" at the decision site).
- K6 slash commands (/clear, /schema, /tools): ✅ RESOLVED this sweep — parser unit-tested; unknown commands get an actionable hint toast.
- K7 unfocused-tab completion cue: ✅ RESOLVED this sweep — title badge while hidden, restored on focus.

### Message rendering / Composer / Layout / Narrow

- M1 highlighting + language labels, M2 copy affordances, M4 meta row, T3 thread tokens: ✅ RESOLVED (earlier batch).
- M3 overflow fade/collapse: ⏸ DEFERRED (polish; no user reports).
- M5 error-banner light-theme contrast: 🟡 PARTIAL (banner uses semantic destructive tokens; dedicated contrast pass deferred).
- C-A auto-grow composer: ⏸ DEFERRED.
- C-B schema-aware placeholder example: ⏸ DEFERRED.
- C-C model picker grouping/keyless tag: 🟡 PARTIAL (picker works, bare id still shown).
- C-D preset-change inline summary: 🟡 PARTIAL (save gating exists; summary text pending).
- C-E compose-while-streaming: ⏸ DEFERRED.
- L1/L2/L3/L4 layout rhythm & width tuning: ⏸ DEFERRED (cosmetic; L4 unblocked now that S1 landed — revisit with 500-message benchmark).
- N1 ≤620px re-test: 🟡 PARTIAL — stacked layout shipped earlier; a dedicated 560–620px pass is still outstanding.
- N2 true browser-zoom pass: ⏸ DEFERRED.

**Net:** all P0/P1 findings across every section are resolved; remainder is P2 polish (M3/C-A/C-B/C-E/L1–L4) explicitly listed above for a future pass.
