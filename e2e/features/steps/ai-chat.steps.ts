import { expect, type Page, type Route } from "@playwright/test";
import path from "node:path";

import { Given, Then, When } from "./fixtures";

/**
 * Deterministic AI chat e2e coverage.
 *
 * Every /api/chat request is intercepted with canned ai-sdk UIMessage SSE
 * payloads (the exact wire format the vendored runtime decodes via
 * `parseJsonEventStream` + `uiMessageChunkSchema`) — no real LLM provider.
 * Outgoing request bodies are captured so approval decisions and provider
 * config can be asserted on the wire.
 */

const BYOK_STORAGE_KEY = "dadabase.openai-api-key";
const CHAT_INPUT = '[data-testid="ai-chat-input"]';
const SEND_BUTTON = '[data-testid="ai-chat-send"]';
const THREAD = '[data-testid="ai-chat-thread"]';
const CONSENT_PARAM = "ai-schema-sharing-consent";

type MockMode =
  | "text"
  | "approval"
  | "fail500"
  | "proposal"
  | "stalled"
  | "workspace_view"
  | "data_tools";

interface ChatTestState {
  mode: MockMode;
  textParts: string[];
  requests: Array<Record<string, unknown>>;
  consoleTexts: string[];
  /** Index into requests already consumed by decision assertions. */
  decisionsCheckedUpTo: number;
  /** Composer/flow round: noted request count + download filename. */
  notedRequestCount?: number;
  downloadName?: string;
  /** Emit a start chunk without messageId (providers without response ids). */
  omitMessageId?: boolean;
  /** Emit model + token usage metadata (audit M4/T3). */
  withUsage?: boolean;
  /** Emit a context receipt on the finish chunk (audit T1/T2). */
  withContext?: boolean;
  /** SQL used by the "proposal" mock mode. */
  proposalSql?: string;
  /** Table/filter payload for the "workspace_view" mock mode (audit: tools). */
  workspaceView?: {
    table: string;
    schema?: string;
    filters?: Array<{ column: string; operator: string; value?: string | number | boolean }>;
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit?: number;
  };
}

const states = new WeakMap<Page, ChatTestState>();

const stateFor = (page: Page): ChatTestState => {
  const existing = states.get(page);
  if (existing) return existing;
  const created: ChatTestState = {
    mode: "text",
    textParts: ["Hello ", "from the mocked ", "assistant stream"],
    requests: [],
    consoleTexts: [],
    decisionsCheckedUpTo: 0,
  };
  states.set(page, created);
  return created;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const sse = (chunks: Array<Record<string, unknown>>): string =>
  chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";

/** The real /api/chat always assigns a conversation id; mocks must too. */
const CONVERSATION_HEADER = { "x-conversation-id": "mock-conv-1" };

const textChunks = (
  parts: readonly string[],
  options: {
    omitMessageId?: boolean;
    withUsage?: boolean;
    withContext?: boolean;
  } = {},
): Array<Record<string, unknown>> => [
  // Providers that return no response message id emit a start chunk without
  // messageId — the runtime must still keep ONE assistant message.
  options.omitMessageId === true
    ? { type: "start" }
    : {
        type: "start",
        messageId: "mock-msg-1",
        ...(options.withUsage === true ? { messageMetadata: { model: "gpt-4o-mini" } } : {}),
      },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  ...parts.map((delta) => ({ type: "text-delta", id: "t1", delta })),
  { type: "text-end", id: "t1" },
  { type: "finish-step" },
  {
    type: "finish",
    finishReason: "stop",
    ...(options.withUsage === true || options.withContext === true
      ? {
          messageMetadata: {
            ...(options.withUsage === true
              ? {
                  model: "gpt-4o-mini",
                  usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
                }
              : {}),
            ...(options.withContext === true
              ? {
                  context: {
                    mode: "auto",
                    tables: ["users"],
                    tools: ["propose_sql"],
                  },
                }
              : {}),
          },
        }
      : {}),
  },
];

const approvalChunks = (): Array<Record<string, unknown>> => [
  { type: "start", messageId: "mock-msg-2" },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: "I drafted a SQL statement for you." },
  { type: "text-end", id: "t1" },
  {
    type: "tool-input-available",
    toolCallId: "call_1",
    toolName: "propose_sql",
    input: { sql: "SELECT count(*) AS users FROM users", reason: "Count users." },
  },
  { type: "tool-approval-request", approvalId: "appr_1", toolCallId: "call_1" },
  { type: "finish-step" },
  { type: "finish", finishReason: "tool-calls" },
];

const workspaceViewChunks = (
  view: NonNullable<ChatTestState["workspaceView"]>,
): Array<Record<string, unknown>> => [
  { type: "start", messageId: "mock-msg-4" },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  {
    type: "text-delta",
    id: "t1",
    delta: `I can open a filtered view of ${view.table} for you.`,
  },
  { type: "text-end", id: "t1" },
  {
    type: "tool-input-available",
    toolCallId: "call_5",
    toolName: "open_workspace_view",
    input: view,
  },
  { type: "tool-output-available", toolCallId: "call_5", output: { ok: true, view } },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
];

/** Completed read-only inspection tools with deterministic result payloads. */
const dataToolsChunks = (): Array<Record<string, unknown>> => [
  { type: "start", messageId: "mock-msg-data-tools" },
  { type: "start-step" },
  { type: "text-start", id: "t-data-tools" },
  { type: "text-delta", id: "t-data-tools", delta: "I checked the table shape and query plan." },
  { type: "text-end", id: "t-data-tools" },
  {
    type: "tool-input-available",
    toolCallId: "preview-call",
    toolName: "preview_rows",
    input: { table: "users", limit: 8 },
  },
  {
    type: "tool-output-available",
    toolCallId: "preview-call",
    output: {
      ok: true,
      columns: [
        "id",
        "name",
        "channel_id",
        "created_at",
        "status",
        "email",
        "country",
        "slug",
        "notes",
        "metadata",
      ],
      rows: [
        { id: 1, name: "Ada", channel_id: "channel-1", email: "ada@example.com" },
        { id: 2, name: "Grace", channel_id: "missing-channel", email: "grace@example.com" },
      ],
      readableColumns: ["name", "channel_id", "channel_id__label"],
      readableRows: [
        { name: "Ada", channel_id: "channel-1", channel_id__label: "Ada Channel" },
        { name: "Grace", channel_id: "missing-channel", channel_id__label: null },
      ],
      readableRelations: [
        {
          sourceColumn: "channel_id",
          label: "display_name",
          referencedTable: "channels",
          resolvedCount: 1,
          unresolvedCount: 1,
        },
      ],
    },
  },
  {
    type: "tool-input-available",
    toolCallId: "details-call",
    toolName: "table_details",
    input: { table: "users" },
  },
  {
    type: "tool-output-available",
    toolCallId: "details-call",
    output: {
      ok: true,
      columns: [{ column_name: "id" }, { column_name: "name" }],
      foreignKeys: [],
      indexes: [{ name: "users_pkey" }],
    },
  },
  {
    type: "tool-input-available",
    toolCallId: "explain-call",
    toolName: "explain_sql",
    input: { sql: "SELECT * FROM users" },
  },
  {
    type: "tool-output-available",
    toolCallId: "explain-call",
    output: { ok: true, rows: [{ plan: "Seq Scan on users" }] },
  },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
];

/** Completed propose_sql (output already available): enables Use-this-SQL/Run buttons. */
const proposalChunks = (sql: string): Array<Record<string, unknown>> => [
  { type: "start", messageId: "mock-msg-3" },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: "Here is a query you can run." },
  { type: "text-end", id: "t1" },
  {
    type: "tool-input-available",
    toolCallId: "call_9",
    toolName: "propose_sql",
    input: { sql },
  },
  { type: "tool-output-available", toolCallId: "call_9", output: { sql } },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
];

const installMock = async (page: Page): Promise<void> => {
  const state = stateFor(page);
  await page.route(/\/api\/chat$/, async (route) => {
    const raw = route.request().postData() ?? "{}";
    try {
      state.requests.push(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      state.requests.push({ raw });
    }
    if (state.mode === "fail500") {
      // Simulated provider/transport failure for an in-flight conversation.
      await sleep(300);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "mocked upstream failure" }),
      });
      return;
    }
    if (state.mode === "stalled") {
      // Audit S5: a stream that would not finish for a long time — Stop must
      // hide the generating state well before the payload ever arrives.
      await sleep(15_000);
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: CONVERSATION_HEADER,
        body: sse(textChunks(state.textParts)),
      });
      return;
    }
    // Small delay so the pending-turn UI state is observable.
    await sleep(500);
    const chunks =
      state.mode === "workspace_view"
        ? workspaceViewChunks(state.workspaceView ?? { table: "users" })
        : state.mode === "data_tools"
          ? dataToolsChunks()
          : state.mode === "approval"
            ? approvalChunks()
            : state.mode === "proposal"
              ? proposalChunks(state.proposalSql ?? "SELECT 42 AS answer")
              : textChunks(state.textParts, {
                  omitMessageId: state.omitMessageId === true,
                  withUsage: state.withUsage === true,
                  withContext: state.withContext === true,
                });
    // The real route always returns the assigned conversation id; mocks must
    // too, or the runtime stays anonymous (blocking retry/revisions and
    // thread-list identification).
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: CONVERSATION_HEADER,
      body: sse(chunks),
    });
  });
};

const openChatPage = async (page: Page): Promise<void> => {
  await page.goto("/connections/e2e-sqlite/ai", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 30_000 });
};

/**
 * Click the consent checkbox until it actually takes effect. Under vite dev
 * the SSR HTML is interactive-looking before React finishes hydrating, so a
 * single early click can be silently dropped.
 */
const approveConsentNow = async (page: Page): Promise<void> => {
  const consent = page.getByTestId(CONSENT_PARAM);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const visible = await consent.isVisible().catch(() => false);
    if (!visible) break;
    await consent.click().catch(() => {});
    // Since C1 the chat surface (composer included) is always mounted, so
    // composer visibility no longer proves approval landed. Wait for the
    // consent banner itself to unmount instead.
    await consent.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
    await sleep(250);
  }
  await expect(consent).toBeHidden({ timeout: 10_000 });
  await expect(page.locator(CHAT_INPUT).or(page.getByTestId("ai-chat-error"))).toBeVisible({
    timeout: 10_000,
  });
};

const approveConsentIfPresent = async (page: Page): Promise<void> => {
  const consent = page.getByTestId(CONSENT_PARAM);
  if (await consent.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await approveConsentNow(page);
    return;
  }
  await expect(page.locator(CHAT_INPUT).or(page.getByTestId("ai-chat-error"))).toBeVisible({
    timeout: 15_000,
  });
};

const typeAndSend = async (page: Page, text: string): Promise<void> => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await input.fill(text);
  await page.locator(SEND_BUTTON).click();
};

Given("console errors are being collected", async ({ page }) => {
  const state = stateFor(page);
  page.on("console", (message) => {
    state.consoleTexts.push(message.text());
  });
  page.on("pageerror", (error) => {
    state.consoleTexts.push(String(error));
  });
});

Given(
  "BYOK chat config preset {string} with key {string} and model {string}",
  async ({ page }, providerId: string, apiKey: string, model: string) => {
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: BYOK_STORAGE_KEY, value: { providerId, apiKey, model } },
    );
  },
);

Given(
  "the chat API streams a canned text reply in parts {string}, {string}, {string}",
  async ({ page }, partA: string, partB: string, partC: string) => {
    const state = stateFor(page);
    state.textParts = [partA, partB, partC];
    await installMock(page);
  },
);

Given("the chat API streams a canned reply containing a sql code fence", async ({ page }) => {
  const state = stateFor(page);
  state.mode = "text";
  state.textParts = [
    "Here is the query:\n\n",
    "```sql\n",
    "SELECT count(*) FROM users;\n",
    "```\n",
  ];
  await installMock(page);
});

Given(
  "the chat API streams a canned text reply without a message id in parts {string}, {string}, {string}",
  async ({ page }, partA: string, partB: string, partC: string) => {
    const state = stateFor(page);
    state.textParts = [partA, partB, partC];
    state.omitMessageId = true;
    await installMock(page);
  },
);

Given("the chat API is mocked with canned streams and request recording", async ({ page }) => {
  await installMock(page);
});

Given("the current mock mode is {string}", async ({ page }, mode: string) => {
  stateFor(page).mode = mode as MockMode;
});

When("I open the AI chat page", async ({ page }) => {
  await openChatPage(page);
});

When("I approve sharing schema context", async ({ page }) => {
  await approveConsentNow(page);
});

When("I approve sharing schema context if needed", async ({ page }) => {
  await approveConsentIfPresent(page);
});

When(
  "I reload the page, approve schema context if needed and type {string} character by character",
  async ({ page }, text: string) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 30_000 });
    await approveConsentIfPresent(page);
    const input = page.locator(CHAT_INPUT);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.pressSequentially(text, { delay: 60 });
  },
);

When("I type {string} character by character", async ({ page }, text: string) => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await input.pressSequentially(text, { delay: 60 });
});

When("I type {string} and press send", async ({ page }, text: string) => {
  await typeAndSend(page, text);
});

When("I press the chat send button", async ({ page }) => {
  await page.locator(SEND_BUTTON).click();
});

Then("my message {string} is visible in the thread", async ({ page }, text: string) => {
  await expect(
    page.locator('[data-testid="ai-chat-message"][data-role="user"]', { hasText: text }),
  ).toBeVisible({ timeout: 15_000 });
});

Then("the generating indicator shows while the reply is pending", async ({ page }) => {
  // The mocked endpoint delays ~500ms before answering; the pending-turn
  // status must already be up while we wait.
  await expect(page.getByTestId("ai-generating-status")).toBeVisible({ timeout: 5_000 });
});

Then("the full reply {string} is visible", async ({ page }, text: string) => {
  await expect(page.locator(THREAD)).toContainText(text, { timeout: 20_000 });
});

Then("an approval prompt is shown", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-approval")).toBeVisible({ timeout: 20_000 });
});

When("I reject the proposal", async ({ page }) => {
  await page.getByTestId("ai-chat-reject").click();
});

When("I approve the proposal", async ({ page }) => {
  await page.getByTestId("ai-chat-approve").click();
});

Then(
  "a later chat request carries decision approved {string}",
  async ({ page }, expected: string) => {
    const state = stateFor(page);
    const approved = expected === "true";
    await expect
      .poll(
        () => {
          const fresh = state.requests.slice(state.decisionsCheckedUpTo);
          return fresh.some((body) => JSON.stringify(body).includes(`"approved":${approved}`));
        },
        { timeout: 20_000, intervals: [250, 500, 1_000] },
      )
      .toBe(true);
    state.decisionsCheckedUpTo = state.requests.length;
  },
);

When(
  "I pick preset {string} with base url {string} key {string} model {string}",
  async ({ page }, presetLabel: string, baseUrl: string, apiKey: string, model: string) => {
    // Hydration-safe toggle: retry until the panel actually stays open.
    // Audit C7: configured sections render collapsed — open the section too.
    const settingsPanel = page.getByTestId("ai-provider-settings");
    await expect(async () => {
      if (!(await settingsPanel.isVisible().catch(() => false))) {
        await page.getByTestId("ai-settings-toggle").click({ timeout: 2_000 });
      }
      await expect(settingsPanel).toBeVisible({ timeout: 1_000 });
      if ((await settingsPanel.getAttribute("data-open")) !== "true") {
        await page.getByTestId("ai-section-toggle-provider").click({ timeout: 2_000 });
      }
      await expect(page.getByTestId("ai-provider-select")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await page.getByTestId("ai-provider-select").click();
    await page.getByRole("option", { name: presetLabel }).click();
    if (baseUrl !== "") {
      await page.getByPlaceholder("https://your-endpoint.example.com/v1").fill(baseUrl);
    }
    if (model !== "") {
      await page.getByPlaceholder("gpt-4o-mini").fill(model);
    }
    if (apiKey !== "") {
      await page.getByPlaceholder("sk-…").fill(apiKey);
    }
    // Scoped to the settings panel: the workspace sidebar (visible around the
    // chat page) also contains a "Saved queries" button matching /Save/i.
    await settingsPanel.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(settingsPanel).toBeHidden({ timeout: 10_000 });
  },
);

Then(
  "the last chat request config has provider {string}, base url {string}, key {string} and model {string}",
  async ({ page }, providerId: string, baseUrl: string, apiKey: string, model: string) => {
    const state = stateFor(page);
    await expect.poll(() => state.requests.length, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect
      .poll(() => {
        const last = state.requests.at(-1);
        const config = (last?.config ?? {}) as Record<string, unknown>;
        if (config.providerId !== providerId) return false;
        if (baseUrl === "" && typeof config.baseUrl === "string") return false;
        if (baseUrl !== "" && config.baseUrl !== baseUrl) return false;
        if (apiKey !== "" && config.apiKey !== apiKey) return false;
        if (model !== "" && config.model !== model) return false;
        return true;
      })
      .toBe(true);
  },
);

Then("a chat error becomes visible", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-error")).toBeVisible({ timeout: 20_000 });
});

// ---------------------------------------------------------------------------
// Tool toggles + composer model picker
// ---------------------------------------------------------------------------

const toolIdForLabel = (label: string): string => {
  const known: Record<string, string> = {
    "Propose SQL": "propose_sql",
    "Run SQL": "run_sql",
    "Open workspace view": "open_workspace_view",
    "Preview rows": "preview_rows",
    "Table details": "table_details",
    "Explain SQL": "explain_sql",
  };
  const id = known[label];
  if (id === undefined) throw new Error(`Unknown chat tool label: ${label}`);
  return id;
};

const ALL_CHAT_TOOL_IDS = [
  "explain_sql",
  "open_workspace_view",
  "preview_rows",
  "propose_sql",
  "run_sql",
  "table_details",
];

When("I open the AI settings panel", async ({ page }) => {
  // Audit C7: the section may be collapsed even while its shell is rendered.
  await expect(async () => {
    if (
      !(await page
        .getByTestId("ai-tools-settings")
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByTestId("ai-settings-toggle").click({ timeout: 2_000 });
    }
    await expect(page.getByTestId("ai-tools-settings")).toBeVisible({ timeout: 1_000 });
    if ((await page.getByTestId("ai-tools-settings").getAttribute("data-open")) !== "true") {
      await page.getByTestId("ai-section-toggle-tools").click({ timeout: 2_000 });
    }
    await expect(page.getByTestId("ai-tools-select-all")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
});

When("I toggle tool {string}", async ({ page }, label: string) => {
  // Click the checkbox root itself: clicking the wrapping label can double-
  // fire (label forward + native input) and net out to no change.
  await page.getByTestId(`ai-tool-checkbox-${toolIdForLabel(label)}`).click();
});

Then("all tools are checked by default", async ({ page }) => {
  for (const id of ALL_CHAT_TOOL_IDS) {
    // ark-ui renders the checked state on the control inside the checkbox root.
    await expect(page.getByTestId(`ai-tool-checkbox-${id}`)).toHaveAttribute(
      "data-state",
      "checked",
      { timeout: 10_000 },
    );
  }
});

Then("the last chat request carries enabled tools {string}", async ({ page }, csv: string) => {
  const expected = csv
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .sort();
  const state = stateFor(page);
  await expect
    .poll(
      () => {
        const last = state.requests.at(-1);
        const enabled = (last?.enabledTools ?? []) as string[];
        return JSON.stringify([...enabled].sort());
      },
      { timeout: 20_000 },
    )
    .toBe(JSON.stringify(expected));
});

When('I press "Select all" in the tools settings', async ({ page }) => {
  await page.getByTestId("ai-tools-select-all").click();
});

Then("the composer picker shows model {string}", async ({ page }, model: string) => {
  await expect(page.getByTestId("ai-model-picker")).toContainText(model, { timeout: 10_000 });
});

When("I pick custom model {string} in the composer picker", async ({ page }, model: string) => {
  await page.getByTestId("ai-model-picker").click();
  await page.getByRole("option", { name: "Custom…" }).click();
  const input = page.getByTestId("ai-model-custom-input");
  await input.fill(model);
  await input.press("Enter");
});

Then("the composer is enabled again", async ({ page }) => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("ai-generating-status")).toHaveCount(0);
});

Then("the console contains no stopped-actor errors", async ({ page }) => {
  const texts = stateFor(page).consoleTexts;
  const offenders = texts.filter((text) => /stopped actor/i.test(text));
  expect(offenders, `unexpected stopped-actor console noise:\n${offenders.join("\n")}`).toEqual([]);
});

Then("the connection workspace shell stays visible", async ({ page }) => {
  // The AI chat lives inside the connection workspace: sidebar and tabs bar
  // must remain around the chat surface (regression guard for the flat-route
  // era where the whole workspace chrome disappeared).
  await expect(page.getByTestId("connection-sidebar")).toBeVisible();
  await expect(page.getByTestId("connection-tabs-bar")).toBeVisible();
});

Then("the thread shows exactly {int} assistant reply", async ({ page }, expected: number) => {
  await expect(page.locator('[data-testid="ai-chat-message"][data-role="assistant"]')).toHaveCount(
    expected,
    { timeout: 20_000 },
  );
});

// ---------------------------------------------------------------------------
// "Use this SQL" → editor run bridge
// ---------------------------------------------------------------------------

const RESULTS_MARKER = '[data-testid="sql-result-receipt"]';

Given(
  "the chat API streams a canned propose_sql reply with sql {string}",
  async ({ page }, sql: string) => {
    const state = stateFor(page);
    state.mode = "proposal";
    state.proposalSql = sql;
    await installMock(page);
  },
);

When('I click "Use this SQL" on the assistant proposal', async ({ page }) => {
  // Audit C4: proposed SQL renders expanded by default — no expansion step.
  const visibleSql = page.getByTestId("ai-chat-proposed-sql");
  if (!(await visibleSql.isVisible().catch(() => false))) {
    const summary = page
      .locator('[data-testid="ai-chat-message"][data-role="assistant"] details summary')
      .filter({ hasText: "propose sql" })
      .first();
    await summary.click({ timeout: 20_000 });
  }
  await page.getByTestId("ai-chat-apply-sql").click({ timeout: 20_000 });
});

When('I click "Run" on the assistant proposal', async ({ page }) => {
  // Audit C4: proposed SQL renders expanded by default — no expansion step.
  const visibleSql = page.getByTestId("ai-chat-proposed-sql");
  if (await visibleSql.isVisible().catch(() => false)) {
    await page.getByTestId("ai-chat-run-sql").click({ timeout: 20_000 });
    return;
  }
  const summary = page
    .locator('[data-testid="ai-chat-message"][data-role="assistant"] details summary')
    .filter({ hasText: "propose sql" })
    .first();
  await summary.click({ timeout: 20_000 });
  await page.getByTestId("ai-chat-run-sql").click({ timeout: 20_000 });
});

Then("I land on a custom SQL editor seeded with the proposal", async ({ page }) => {
  // The trailing ? anchors us off the AI page, whose path also contains the
  // connection slug.
  await expect(page).toHaveURL(/\/connections\/e2e-sqlite\?/, { timeout: 30_000 });
  // While an auto-run is in flight the Run button is swapped for Cancel,
  // so only assert the editor surface exists here.
  await expect(page.getByTestId("sql-monaco-panel")).toBeVisible({ timeout: 30_000 });
});

Then("the query is staged but not executed", async ({ page }) => {
  // No auto-run: results must not appear within a short grace period.
  await expect(page.locator(RESULTS_MARKER)).not.toBeVisible({ timeout: 2_500 });
  // The editor's own Run button stays available for the manual path.
  await expect(page.getByTestId("sql-run-button")).toBeEnabled();
});

When("I press Run in the SQL editor", async ({ page }) => {
  await page.getByTestId("sql-run-button").click();
});

Then("the query runs automatically after navigation", async ({ page }) => {
  // The staged handoff executes without any user interaction.
  await expect(page.locator(RESULTS_MARKER)).toBeVisible({ timeout: 30_000 });
});

Then("the query results are shown", async ({ page }) => {
  await expect(page.locator(RESULTS_MARKER)).toBeVisible({ timeout: 30_000 });
});

// --- Schema table selection (manual + auto mode) ---

const SCHEMA_HINT = '[data-testid="ai-schema-context-hint"]';

const schemaModeButton = (mode: string): string => {
  const normalized = mode.toLowerCase();
  if (!["all", "selected", "auto"].includes(normalized)) {
    throw new Error(`Unknown schema mode: ${mode}`);
  }
  return `[data-testid="ai-schema-mode-${normalized}"]`;
};

const schemaTableCheckbox = (table: string): string =>
  `[data-testid="ai-schema-table-checkbox-${table}"]`;

When("I open the AI schema settings", async ({ page }) => {
  // Audit C7: the section may be collapsed even while its shell is rendered.
  await expect(async () => {
    if (
      !(await page
        .getByTestId("ai-schema-settings")
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByTestId("ai-settings-toggle").click({ timeout: 2_000 });
    }
    await expect(page.getByTestId("ai-schema-settings")).toBeVisible({ timeout: 1_000 });
    if ((await page.getByTestId("ai-schema-settings").getAttribute("data-open")) !== "true") {
      await page.getByTestId("ai-section-toggle-schema").click({ timeout: 2_000 });
    }
    await expect(page.locator('[data-testid^="ai-schema-mode-"]').first()).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
});

When("I close the AI settings panel", async ({ page }) => {
  await page.getByTestId("ai-settings-toggle").click();
  await expect(page.getByTestId("ai-provider-settings")).toBeHidden();
});

When("I pick schema mode {string}", async ({ page }, mode: string) => {
  await page.locator(schemaModeButton(mode)).click();
});

When("I toggle schema table {string}", async ({ page }, table: string) => {
  await page.locator(schemaTableCheckbox(table)).click();
});

Then("the last chat request carries schema tables {string}", async ({ page }, csv: string) => {
  const expected = csv
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .sort();
  const state = stateFor(page);
  await expect
    .poll(
      () => {
        const last = state.requests.at(-1);
        const schemaContext = last?.schemaContext as
          | { tables?: Array<{ table?: string }> }
          | undefined;
        const tables = (schemaContext?.tables ?? [])
          .map((t) => t.table ?? "")
          .filter((name) => name.length > 0)
          .sort();
        return JSON.stringify(tables);
      },
      { timeout: 20_000 },
    )
    .toBe(JSON.stringify(expected));
});

Then("the last chat request carries schema mode {string}", async ({ page }, mode: string) => {
  const state = stateFor(page);
  await expect
    .poll(
      () => {
        const last = state.requests.at(-1);
        return last?.schemaMode ?? "(absent)";
      },
      { timeout: 20_000 },
    )
    .toBe(mode);
});

Then("the schema hint shows the whole-database default", async ({ page }) => {
  await expect(page.locator(SCHEMA_HINT)).toContainText("Using whole database schema", {
    timeout: 10_000,
  });
});

Then("the schema hint reports a manual subset", async ({ page }) => {
  await expect(page.locator(SCHEMA_HINT)).toContainText("manually selected", {
    timeout: 10_000,
  });
});

Then("the schema hint reports auto mode with fewer tables than exist", async ({ page }) => {
  const text = () => page.locator(SCHEMA_HINT).textContent();
  await expect
    .poll(
      async () => {
        const value = (await text()) ?? "";
        // Either the resolved count ("Auto schema: using N of M") or the
        // pre-resolution label must indicate auto mode is active.
        return value.includes("Auto schema") ? "auto" : value;
      },
      { timeout: 20_000 },
    )
    .toBe("auto");
});

// --- C1: consent gate keeps the surface mounted, gating only Send ---

Then("the chat surface is visible while schema consent is still pending", async ({ page }) => {
  await expect(page.locator(CHAT_INPUT)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(CONSENT_PARAM)).toBeVisible();
});

Then("the send button is disabled because of pending schema consent", async ({ page }) => {
  await expect(page.locator(SEND_BUTTON)).toBeDisabled();
  await expect(page.getByTestId("ai-chat-send-reason")).toContainText(/schema sharing/i);
});

Then("the send button becomes enabled", async ({ page }) => {
  await expect(page.locator(SEND_BUTTON)).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId("ai-chat-send-reason")).toHaveCount(0);
});

// --- C2: keyless local providers must be able to send without a key ---
Then("the send button is enabled without any API key", async ({ page }) => {
  await expect(page.locator(SEND_BUTTON)).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId("ai-chat-send-reason")).toHaveCount(0);
});

When("I fill the chat composer with {string}", async ({ page }, text: string) => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(text);
});

// --- C13: legacy bare-string key storage migrates on first read ---

Given(
  "a legacy bare-string OpenAI API key {string} stored from an older version",
  async ({ page }, apiKey: string) => {
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: BYOK_STORAGE_KEY, value: apiKey },
    );
  },
);

Then(
  "the stored chat config has been migrated to provider {string} with key {string}",
  async ({ page }, providerId: string, apiKey: string) => {
    await expect
      .poll(
        async () => {
          const raw = await page.evaluate(
            (key) => window.localStorage.getItem(key),
            BYOK_STORAGE_KEY,
          );
          if (raw == null) return false;
          const parsed = JSON.parse(raw) as { providerId?: string; apiKey?: string } | string;
          // Migration means the legacy bare string is rewritten as an object.
          return (
            typeof parsed === "object" &&
            parsed.providerId === providerId &&
            parsed.apiKey === apiKey
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  },
);

// --- C3: the schema status line must never report zero tables ---

Then("the schema context hint never reports zero tables", async ({ page }) => {
  const offending = (text: string) => text.includes("(0 tables");
  await expect
    .poll(
      async () => {
        const text = (await page.locator(SCHEMA_HINT).textContent()) ?? "";
        return offending(text) ? "lying" : "honest";
      },
      { timeout: 20_000 },
    )
    .toBe("honest");
});

// ---------------------------------------------------------------------------
// Audit C-batch UX affordances (C4, C5, C7, C11, C12)
// ---------------------------------------------------------------------------

Then("the proposed SQL is visible without expanding any tool group", async ({ page }) => {
  const sql = page.getByTestId("ai-chat-proposed-sql");
  await expect(sql).toBeVisible({ timeout: 20_000 });
  await expect(sql).toContainText("SELECT 42");
});

Then("the generating indicator shows elapsed seconds", async ({ page }) => {
  await expect(page.getByTestId("ai-generating-status")).toBeVisible({ timeout: 5_000 });
  // Elapsed counter renders as "Generating… <n>s".
  await expect(page.getByTestId("ai-generating-status")).toContainText(/Generating… \d+s/, {
    timeout: 3_000,
  });
});

When("I stop the generation", async ({ page }) => {
  await page.getByTestId("ai-chat-cancel").click({ timeout: 5_000 });
});

Then("the composer recovers after stopping", async ({ page }) => {
  await expect(page.getByTestId("ai-generating-status")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ai-chat-input")).toBeEnabled();
});

Then("the threads list is visible", async ({ page }) => {
  const list = page.getByTestId("ai-thread-list").or(page.getByTestId("ai-thread-list-desktop"));
  await expect(list).toBeVisible({ timeout: 10_000 });
  const ghost = list.getByTestId("ai-thread-list-ghost");
  const items = list.getByTestId("ai-thread-item");
  await expect
    .poll(async () => (await ghost.isVisible().catch(() => false)) || (await items.count()) > 0, {
      timeout: 5_000,
    })
    .toBe(true);
});

Then(
  "the schema mode switcher is a labelled radiogroup with {string} checked",
  async ({ page }, label: string) => {
    const group = page.getByRole("radiogroup", { name: "Schema selection mode" });
    await expect(group).toBeVisible({ timeout: 10_000 });
    const selected = group.getByRole("radio", { name: label });
    await expect(selected).toHaveAttribute("aria-checked", "true");
  },
);

Then(
  "schema mode {string} reports checked and {string} does not",
  async ({ page }, checkedLabel: string, uncheckedLabel: string) => {
    const group = page.getByRole("radiogroup", { name: "Schema selection mode" });
    await expect(group.getByRole("radio", { name: checkedLabel })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(group.getByRole("radio", { name: uncheckedLabel })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  },
);

When("I toggle the AI settings region open", async ({ page }) => {
  // Hydration-safe: retry until the region actually stays open.
  await expect(async () => {
    if (
      !(await page
        .getByTestId("ai-provider-settings")
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByTestId("ai-settings-toggle").click({ timeout: 2_000 });
    }
    await expect(page.getByTestId("ai-provider-settings")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
});

Then("provider, tools, and schema sections are present but collapsed", async ({ page }) => {
  for (const testid of ["ai-provider-settings", "ai-tools-settings", "ai-schema-settings"]) {
    const section = page.getByTestId(testid);
    await expect(section).toBeVisible({ timeout: 10_000 });
    // Audit C7: configured sections start collapsed (data-open !== "true").
    await expect(section).not.toHaveAttribute("data-open", "true");
  }
});

// --- Audit S1/S2/N1/C8 follow-ups -------------------------------------------

Given("a persisted chat thread {string} exists for the connection", async ({}, title: string) => {
  // The SSE mock intercepts every /api/chat POST, so server-side turn
  // persistence never runs under test. Seed a real thread row instead:
  // this exercises the true hydration path (server fn → decode → store).
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(process.cwd(), "e2e", ".tmp", "app.db"));
  const connection = db
    .prepare("SELECT id FROM database_connections WHERE name = 'e2e-sqlite'")
    .get();
  if (!connection) throw new Error("e2e-sqlite fixture connection not found");
  const now = Date.now();
  const threadId = `e2e-thread-${title.replace(/\s+/g, "-").toLowerCase()}`;
  db.prepare(
    "INSERT OR REPLACE INTO chat_threads (id, connection_id, title, status, pinned, created_at, updated_at) VALUES (?, ?, ?, 'regular', 0, ?, ?)",
  ).run(threadId, connection.id, title, now, now);
  const insertMessage = db.prepare(
    "INSERT INTO chat_messages (id, thread_id, role, parts, model, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
  );
  insertMessage.run(
    `${threadId}-user`,
    threadId,
    "user",
    JSON.stringify([{ type: "text", text: "count the users table rows" }]),
    now,
  );
  insertMessage.run(
    `${threadId}-assistant`,
    threadId,
    "assistant",
    JSON.stringify([{ type: "text", text: "Hello from the mocked assistant stream" }]),
    now,
  );
  db.close();
});

When("I reload the chat page", async ({ page }) => {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 30_000 });
});

Then("the thread list shows a chat titled {string}", async ({ page }, title: string) => {
  // Hydration is async after mount (store request + decode) — poll.
  try {
    await expect(page.getByTestId("ai-thread-item").filter({ hasText: title }).first()).toBeVisible(
      { timeout: 20_000 },
    );
  } catch {
    const consoleTail = stateFor(page).consoleTexts.slice(-6);
    const diag = await page.evaluate(() => ({
      items: document.querySelectorAll('[data-testid="ai-thread-item"]').length,
      ghost: document.querySelectorAll('[data-testid="ai-thread-list-ghost"]').length,
      lsKeys: Object.keys(window.localStorage),
      reqs: performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((n) => n.includes("chat") || n.includes("server") || n.includes("fn"))
        .slice(-8),
    }));
    throw new Error(
      `thread item "${title}" not visible; diag=${JSON.stringify(diag)} console=${JSON.stringify(consoleTail)}`,
    );
  }
});

When("I open the thread titled {string}", async ({ page }, title: string) => {
  await page
    .getByTestId("ai-thread-item")
    .filter({ hasText: title })
    .first()
    .click({ timeout: 20_000 });
});

Then("the schema-sharing consent banner is not shown", async ({ page }) => {
  await expect(page.getByTestId(CONSENT_PARAM)).toHaveCount(0, { timeout: 10_000 });
});

Then("I can send a message without approving again", async ({ page }) => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByTestId("ai-chat-send-reason")).toHaveCount(0);
});

Given(
  "the viewport is {int} px wide by {int} px tall",
  async ({ page }, width: number, height: number) => {
    await page.setViewportSize({ width, height });
  },
);

Then("the chat thread is visible and the page has no horizontal overflow", async ({ page }) => {
  // Audit N1/C6 regression guard: thread stays mounted and usable at 620px.
  await expect(page.locator(THREAD)).toBeVisible({ timeout: 15_000 });
  const overflowPx = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowPx).toBeLessThanOrEqual(1);
});

Then("the assistant role label precedes its message text", async ({ page }) => {
  // Audit C8 contract: within an assistant message the sr-only author label
  // must be the FIRST element inside the bubble content, so screen readers
  // meet the author before the words regardless of visual order.
  const isFirst = await page.evaluate(() => {
    const message = document.querySelector(
      '[data-testid="ai-chat-message"][data-role="assistant"]',
    );
    if (!message) return false;
    const srOnly = message.querySelector(".sr-only");
    if (!srOnly || !srOnly.textContent?.includes("Assistant")) return false;
    return srOnly.parentElement?.firstElementChild === srOnly;
  });
  expect(isFirst).toBe(true);
});

// ---------------------------------------------------------------------------
// Audit M1/M2/M4/T3: highlighting, copy affordances, message meta
// ---------------------------------------------------------------------------

Given("the chat API streams a canned reply carrying model and token usage", async ({ page }) => {
  const state = stateFor(page);
  state.mode = "text";
  state.withUsage = true;
  await installMock(page);
});

Given("clipboard permissions are granted", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
});

When("I copy the assistant code block", async ({ page }) => {
  await page.getByTestId("code-copy").first().click({ timeout: 20_000 });
});

Then(
  "the assistant reply contains a highlighted {string} code block",
  async ({ page }, language: string) => {
    const block = page.getByTestId("chat-code-block").first();
    await expect(block).toBeVisible({ timeout: 20_000 });
    await expect(block.getByTestId("code-language")).toHaveText(language.toUpperCase());
    const keywordCount = await block.locator(".hljs-keyword").count();
    expect(keywordCount).toBeGreaterThan(0);
  },
);

Then("the clipboard contains {string}", async ({ page }, expected: string) => {
  const content = await page.evaluate(() => navigator.clipboard.readText());
  expect(content.trim()).toBe(expected.trim());
});

Then("the last assistant message shows model and token meta", async ({ page }) => {
  const footer = page
    .locator('[data-testid="ai-chat-message"][data-role="assistant"]')
    .last()
    .locator('[data-slot="message-footer"]')
    .first();
  await expect(footer.getByText("gpt-4o-mini")).toBeVisible({ timeout: 20_000 });
  await expect(footer.getByText("46 tokens")).toBeVisible();
});

Then("the composer area shows the thread token total", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-thread-tokens")).toContainText("46 tokens this thread");
});

When("I copy the proposed SQL", async ({ page }) => {
  await page.getByTestId("copy-proposed-sql").first().click({ timeout: 20_000 });
});

// ---------------------------------------------------------------------------
// Audit round: composer & flows (K1, S3-S6, S8, K2, K3)
// ---------------------------------------------------------------------------

const threadRow = (page: Page, title: string) =>
  page
    .locator("li")
    .filter({ has: page.getByTestId("ai-thread-item") })
    .filter({ hasText: title });

When("I type {string} in the chat composer", async ({ page }, text: string) => {
  const input = page.locator(CHAT_INPUT);
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await input.fill(text);
});

When("I type {string} more in the chat composer", async ({ page }, text: string) => {
  // Append without replacing: Shift+Enter newline tests depend on this.
  await page.locator(CHAT_INPUT).pressSequentially(text, { delay: 40 });
});

When("I press Enter in the chat composer", async ({ page }) => {
  await page.locator(CHAT_INPUT).press("Enter");
});

When("I press Shift+Enter in the chat composer", async ({ page }) => {
  await page.locator(CHAT_INPUT).press("Shift+Enter");
});

Then("the composer shows the keyboard hint", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-kbd-hint")).toContainText("Enter to send");
});

Then("the composer is empty after sending", async ({ page }) => {
  await expect(page.locator(CHAT_INPUT)).toHaveValue("", { timeout: 10_000 });
});

Then("the composer value contains a newline", async ({ page }) => {
  const value = await page.locator(CHAT_INPUT).inputValue();
  const hasNewline = value.includes("\n");
  expect(hasNewline, `expected newline in draft, got ${JSON.stringify(value)}`).toBe(true);
});

Then("the composer contains {string}", async ({ page }, text: string) => {
  await expect(page.locator(CHAT_INPUT)).toHaveValue(text, { timeout: 10_000 });
});

Then("the latest assistant reply offers retry", async ({ page }) => {
  // After a failed stream the retry affordance sits on the latest user turn.
  await expect(page.locator(THREAD).getByText("Retry message").first()).toBeVisible({
    timeout: 10_000,
  });
});

When("I note the number of chat requests", async ({ page }) => {
  stateFor(page).notedRequestCount = stateFor(page).requests.length;
});

When("I retry the latest assistant reply", async ({ page }) => {
  await page.locator(THREAD).getByText("Retry message").first().click({ timeout: 15_000 });
});

Then("at least one more chat request has been sent", async ({ page }) => {
  const state = stateFor(page);
  await expect
    .poll(() => state.requests.length, { timeout: 15_000 })
    .toBeGreaterThan(state.notedRequestCount ?? 0);
});

Then("the generating indicator disappears after stopping", async ({ page }) => {
  // The mocked stream would only complete after 15s — hiding within 5s
  // proves the client actually aborted instead of waiting it out.
  await expect(page.getByTestId("ai-generating-status")).toBeHidden({ timeout: 5_000 });
});

Then("a back-to-chat link for the conversation is shown", async ({ page }) => {
  const link = page.getByTestId("ai-chat-return-link");
  const visible = await link.isVisible().catch(() => false);
  if (!visible) {
    const diag = await page.evaluate(() => ({
      s8: (window as Record<string, unknown>).__s8,
      s8click: (window as Record<string, unknown>).__s8click,
      ss: Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, i) => {
          const k = window.sessionStorage.key(i);
          return [k, window.sessionStorage.getItem(k)?.slice(0, 80)];
        }),
      ),
    }));
    throw new Error(`back-to-chat link missing; sessionStorage=${JSON.stringify(diag)}`);
  }
  await expect(link).toContainText("Back to chat ·", { timeout: 10_000 });
});

When("I follow the back-to-chat link", async ({ page }) => {
  await page.getByTestId("ai-chat-return-link").click({ timeout: 10_000 });
});

Then("the AI chat page is open again", async ({ page }) => {
  await expect(page).toHaveURL(/\/ai/, { timeout: 20_000 });
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 20_000 });
});

const threadRowByTitle = (page: Page, title: string) => threadRow(page, title).first();

When("I pin the chat titled {string}", async ({ page }, title: string) => {
  await threadRowByTitle(page, title).getByTestId("ai-thread-pin").click();
});

Then("the chat titled {string} shows as pinned", async ({ page }, title: string) => {
  await expect(threadRowByTitle(page, title).getByTestId("ai-thread-pin")).toHaveAttribute(
    "aria-label",
    `Unpin chat ${title}`,
    { timeout: 10_000 },
  );
});

When(
  "I rename the chat titled {string} to {string}",
  async ({ page }, from: string, to: string) => {
    // Clicking rename swaps the title button for the inline input, so the row
    // locator by old title no longer matches — scope the input globally (only
    // one rename is active at a time).
    await threadRowByTitle(page, from).getByTestId("ai-thread-rename").click();
    const input = page.getByTestId("ai-thread-rename-input");
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill(to);
    await input.press("Enter");
  },
);

When("I delete the chat titled {string}", async ({ page }, title: string) => {
  // Two-step destructive flow (audit S3): first click only requests it.
  await threadRowByTitle(page, title).getByTestId("ai-thread-delete").click();
});

Then("a delete confirmation is requested for {string}", async ({ page }, title: string) => {
  await expect(threadRowByTitle(page, title).getByTestId("ai-thread-delete-confirm")).toBeVisible({
    timeout: 5_000,
  });
});

When("I confirm deleting the chat titled {string}", async ({ page }, title: string) => {
  await threadRowByTitle(page, title).getByTestId("ai-thread-delete-confirm").click();
});

Then("the thread list no longer shows a chat titled {string}", async ({ page }, title: string) => {
  await expect(threadRowByTitle(page, title)).toHaveCount(0, { timeout: 10_000 });
});

When("I search chats for {string}", async ({ page }, query: string) => {
  await page.getByTestId("ai-thread-search").fill(query);
});

Then("only chats matching {string} are listed", async ({ page }, query: string) => {
  const items = page.getByTestId("ai-thread-item");
  await expect(items.filter({ hasText: query }).first()).toBeVisible({ timeout: 10_000 });
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    expect(await items.nth(index).innerText()).toMatch(new RegExp(query, "i"));
  }
});

When("I export the chat as markdown", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("ai-chat-actions").click();
  await page.getByRole("menuitem", { name: "Export Markdown", exact: true }).click();
  stateFor(page).downloadName = (await downloadPromise).suggestedFilename();
});

Then("a markdown download named after the chat is offered", async ({ page }) => {
  const name = stateFor(page).downloadName ?? "";
  const isMarkdown = name.endsWith(".md");
  expect(isMarkdown, `expected .md download, got ${name}`).toBe(true);
});

Given("the chat API mock emits a context receipt", async ({ page }) => {
  stateFor(page).withContext = true;
});

When("I open the AI chat page with askTable {string}", async ({ page }, table: string) => {
  await page.goto(`/connections/e2e-sqlite/ai?askTable=${table}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 30_000 });
});

Then(
  "an assistant context receipt shows mode {string} with table {string}",
  async ({ page }, mode: string, table: string) => {
    const receipt = page.getByTestId("ai-chat-context-receipt");
    await expect(receipt).toBeVisible({ timeout: 15_000 });
    await expect(receipt).toContainText(mode);
    await expect(receipt).toContainText(table);
  },
);

Then("the schema status reports a manually selected subset", async ({ page }) => {
  await expect(page.getByTestId("ai-schema-context-hint")).toContainText("manually selected", {
    timeout: 15_000,
  });
});

When("I open the connection workspace", async ({ page }) => {
  await page.goto("/connections/e2e-sqlite", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.getByTestId("connection-tabs-bar")).toBeVisible({ timeout: 30_000 });
});

When("I pick table {string} from the new-tab listbox", async ({ page }, table: string) => {
  await page.getByTestId(`empty-tab-option-${table}`).click({ timeout: 15_000 });
  await expect(page.getByTestId("rows-table-panel")).toBeVisible({ timeout: 20_000 });
});

Then("the rows grid is visible", async ({ page }) => {
  await expect(page.getByTestId("rows-table-panel")).toBeVisible({ timeout: 15_000 });
});

When("I open a new AI tab from the tab strip", async ({ page }) => {
  await page.getByTestId("tab-ai-new").click();
});

When("I switch back to the {string} workspace tab", async ({ page }, name: string) => {
  await page.locator("[data-table-tab]").filter({ hasText: name }).first().click();
  await expect(page.locator("[data-table-tab]").filter({ hasText: name }).first()).toHaveAttribute(
    "data-table-tab-active",
    /.*/,
  );
});

When("I switch to the AI assistant workspace tab", async ({ page }) => {
  await page.locator("[data-table-tab]").filter({ hasText: "AI Assistant" }).first().click();
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 15_000 });
});

Then("the AI assistant is visible inside the workspace tabs", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-tabs-bar")).toBeVisible();
  // Embedded mode keeps the workspace URL — not the flat /ai route.
  expect(new URL(page.url()).pathname).not.toContain("/ai");
});

Then("the tab strip shows {int} tabs", async ({ page }, count: number) => {
  await expect(page.locator("[data-table-tab]")).toHaveCount(count);
});

When("I click {string}", async ({ page }, label: string) => {
  if (label === "Suggest query with AI") {
    const btn = page.getByTestId("suggest-query-ai");
    // The SQL preview collapses by default; the button lives in its toolbar.
    if (!(await btn.isVisible().catch(() => false))) {
      await page.getByTestId("sql-query-toggle").click();
    }
    await btn.click({ timeout: 15_000 });
    return;
  }
  throw new Error(`Unhandled generic click step: ${label}`);
});

// ---------------------------------------------------------------------------
// open_workspace_view tool
// ---------------------------------------------------------------------------

Given(
  "the chat API streams an open_workspace_view call for table {string} filtered by {string} equals {string}",
  async ({ page }, table: string, column: string, value: string) => {
    const state = stateFor(page);
    state.mode = "workspace_view";
    state.workspaceView = {
      table,
      filters: [{ column, operator: "equals", value }],
      orderBy: { column: "id", direction: "desc" },
      limit: 100,
    };
    await installMock(page);
  },
);

When("I click the open workspace view card button", async ({ page }) => {
  await page.getByTestId("ai-chat-open-view").click();
});

Then(
  "a browse tab opens on table {string} with a filter on {string}",
  async ({ page }, table: string, column: string) => {
    // Embedded mode keeps the workspace URL; the new tab is active and named.
    expect(new URL(page.url()).pathname).not.toContain("/ai");
    await expect(page.locator("[data-table-tab]").last()).toContainText(table);
    const url = new URL(page.url());
    // Workspace tab state rides URL-encoded (zipson + base64); decode to assert.
    const tabsParam = url.searchParams.get("tabs") ?? "";
    const decoded = Buffer.from(tabsParam, "base64").toString("utf8");
    expect(decoded).toContain(table);
    expect(decoded).toContain(column);
  },
);

Then("the workspace view card is visible", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-workspace-view-card")).toBeVisible();
});

Given("the chat API streams read-only inspection tool results", async ({ page }) => {
  stateFor(page).mode = "data_tools";
  await installMock(page);
});

Then("the preview rows result is visible", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-preview-rows")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ai-chat-preview-rows")).toContainText("Ada");
  await expect(page.getByTestId("ai-chat-relation-status")).toContainText("1 ID unresolved");
  await expect(page.getByTestId("ai-chat-raw-preview")).not.toHaveAttribute("open");
  await page.getByTestId("ai-chat-raw-preview").locator("summary").click();
  await expect(page.getByTestId("ai-chat-raw-preview")).toHaveAttribute("open", "");
  await page.getByTestId("ai-chat-preview-columns").click();
  await expect(page.getByRole("menuitemcheckbox", { name: "metadata" })).toBeVisible();
  await page.getByRole("menuitemcheckbox", { name: "metadata" }).click();
  await expect(page.getByTestId("ai-chat-raw-preview")).toContainText("metadata");
});

Then("the successful AI reply does not offer retry", async ({ page }) => {
  await expect(page.locator(THREAD).getByText("Retry message")).toHaveCount(0);
});

Then("the readable AI preview matches its visual snapshot", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-preview-rows")).toHaveScreenshot(
    "ai-chat-readable-preview.png",
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.03,
    },
  );
});

When("I open the AI sidechat", async ({ page }) => {
  await page.getByTestId("toggle-ai-sidechat").click();
  await expect(page.getByTestId("ai-sidechat-overlay")).toBeVisible({ timeout: 15_000 });
});

When("I resize the AI sidechat to its wide keyboard size", async ({ page }) => {
  const handle = page.getByTestId("ai-sidechat-resize-handle");
  await handle.focus();
  await handle.press("End");
});

Then("the AI sidechat matches the {string} visual snapshot", async ({ page }, name: string) => {
  await expect(page.getByTestId("ai-sidechat-overlay")).toHaveScreenshot(
    `ai-sidechat-${name}.png`,
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.03,
    },
  );
});

When("I set a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

Then("the mobile AI sidechat resize handle is visible", async ({ page }) => {
  await expect(page.getByTestId("ai-sidechat-mobile-resize-handle")).toBeVisible();
});

Then("the table details result is visible", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-table-details")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ai-chat-table-details")).toContainText("id");
});

Then("the explain SQL result is visible", async ({ page }) => {
  await expect(page.getByTestId("ai-chat-explain-plan")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ai-chat-explain-plan")).toContainText("Seq Scan");
});
