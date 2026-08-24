# Vendored chat runtime

Fork-copied from emi-healthfit `@emi/core` (`packages/core/src`), adapted for dadabase.

## Layout

- `protocol/` — provider-neutral wire model. **Rewritten from effect/Schema to zod 4**;
  shapes and part-type unions are preserved exactly (UI depends on them).
- `runtime/` + `react-hooks.ts` — framework-free chat store + React bindings (near-verbatim).
- `chat/` — request/settings/ui-message types + helpers (error-message, message-collapse,
  orphan-turn, generation-terminal-state).
- `web/chat-runtime/` — xstate 5 actor system: transport, lifecycle, UI, browser state,
  follow-up queue, conversation store/client, settings, suggestions.
- `web/thread/` — thread UI components.
- `web/conversation/` — conversation tree helpers.
- `components/styled/internal/ui/` — minimal local shims of upstream styled primitives
  (Button/Bubble/Message copied; Sheet re-exported from dadabase's ark-ui kit).

## Consciously dropped (vs @emi/core)

auth/ (better-auth), webmcp host + actor, sidebar/, attachments/, dexie session-cache,
dynamic shell/contributions assembly beyond what thread components need, discord/cloudflare/
server adapters, full AI SDK UIMessage bridge (only a type stub at `chat/ui-messages.ts`;
the real bridge lands with Phase B wire-up).

## Rules of engagement

- One-way copy: do NOT keep a sync bridge back to `@emi/core`. Fix forward here.
- Keep files structurally close to upstream so future upstream fixes port cleanly;
  `.oxlintrc.json` has a scoped override for vendored patterns (static-only classes,
  nested components, fire-and-forget thens) — do not refactor those.
- The transport seam (`web/chat-runtime/transport-types.ts`) stays injectable:
  dadabase wires its own `ChatStreamDecoder` over an ai-sdk `streamText` route in Phase B.
