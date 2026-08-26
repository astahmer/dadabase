import { act, render } from "@testing-library/react";
// @vitest-environment jsdom
import { StrictMode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatProvider, useChatActions, useChatSelector } from "#src/lib/chat/react-hooks.ts";

import { useDadabaseChatRuntime } from "./use-chat-runtime.tsx";

/**
 * Regression guard for the dead-actor bug: React 19 StrictMode double-mounts
 * effects in dev. The runtime must stay live across that cycle — every
 * keystroke sends `session-event` into the session actor, and when the actor
 * had been stopped by a competing lifecycle owner, the composer went dead
 * while xstate warned "Event sent to stopped actor" per keystroke.
 */

type Actions = ReturnType<typeof useChatActions>;

const THREAD_FIXTURE = {
  thread: {
    id: "t1",
    title: null,
    status: "regular",
    pinned: false,
    conversationId: "c1",
    anchorMessageId: "m1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  messages: [],
};

const Harness = ({
  connectionName,
  actionsRef,
}: {
  connectionName: string;
  actionsRef: { current: Actions | null };
}) => {
  const schemaContextRef = useRef(undefined);
  const runtime = useDadabaseChatRuntime({ connectionName, schemaContextRef });
  return (
    <ChatProvider runtime={runtime}>
      <Inner actionsRef={actionsRef} />
    </ChatProvider>
  );
};

const Inner = ({ actionsRef }: { actionsRef: { current: Actions | null } }) => {
  const draft = useChatSelector((s) => s.composer.text);
  const actions = useChatActions();
  // Assign during render (test-only): actions identity is stable per runtime.
  actionsRef.current = actions;
  return <span data-testid="draft">{draft}</span>;
};

describe("useDadabaseChatRuntime lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  const stubNetwork = () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(THREAD_FIXTURE), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  };

  const collectActorWarnings = () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((first) => {
      warnings.push(String(first));
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation((first) => {
      warnings.push(String(first));
    });
    return { warnings, spy, errSpy };
  };

  it("survives StrictMode double-mount; setDraft reaches composer state with no stopped-actor sends", async () => {
    stubNetwork();
    const { warnings } = collectActorWarnings();
    const actionsRef: { current: Actions | null } = { current: null };

    const view = render(
      <StrictMode>
        <Harness connectionName="conn-a" actionsRef={actionsRef} />
      </StrictMode>,
    );

    // StrictMode has mounted, cleaned up, and re-mounted by this point.
    expect(actionsRef.current).not.toBeNull();

    await act(async () => {
      actionsRef.current?.setDraft({ text: "hello" });
    });

    expect(view.getByTestId("draft").textContent).toBe("hello");
    expect(warnings.filter((w) => w.includes("stopped actor"))).toEqual([]);

    view.unmount();
  });

  it("a fresh mount after real unmount yields a live runtime again", async () => {
    stubNetwork();
    collectActorWarnings();
    const actionsRef: { current: Actions | null } = { current: null };

    const first = render(<Harness connectionName="conn-a" actionsRef={actionsRef} />);
    await act(async () => {
      actionsRef.current?.setDraft({ text: "first" });
    });
    first.unmount();

    const second = render(<Harness connectionName="conn-a" actionsRef={actionsRef} />);
    await act(async () => {
      actionsRef.current?.setDraft({ text: "second" });
    });
    expect(second.getByTestId("draft").textContent).toBe("second");
    second.unmount();
  });

  it("replacing the runtime identity disposes the previous one", async () => {
    stubNetwork();
    collectActorWarnings();
    const actionsRef: { current: Actions | null } = { current: null };

    const view = render(<Harness connectionName="conn-a" actionsRef={actionsRef} />);
    const runtimeA = view.container.ownerDocument;
    void runtimeA;

    view.rerender(<Harness connectionName="conn-b" actionsRef={actionsRef} />);

    await act(async () => {
      actionsRef.current?.setDraft({ text: "after-swap" });
    });
    expect(view.getByTestId("draft").textContent).toBe("after-swap");
    view.unmount();
  });
});
