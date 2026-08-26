import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:3005";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (/error|warn/i.test(t)) console.log("[console]", t.slice(0, 200));
});
const fnCalls = [];
page.on("request", (r) => {
  if (r.url().includes("_serverFn") || r.url().includes("rpc"))
    fnCalls.push(["req", r.method(), r.url().slice(0, 140)]);
});
page.on("response", (r) => {
  if (r.url().includes("_serverFn") || r.url().includes("rpc"))
    fnCalls.push(["res", String(r.status()), r.url().slice(0, 140)]);
});

await page.addInitScript(() => {
  window.localStorage.setItem(
    "dadabase.openai-api-key",
    JSON.stringify({ providerId: "openai", apiKey: "sk-e2e-key", model: "gpt-4o-mini" }),
  );
});
const sse = (chunks) =>
  chunks.map((c) => "data: " + JSON.stringify(c) + "\n\n").join("") + "data: [DONE]\n\n";
const sql = "SELECT 42 AS answer";
const chunks = [
  { type: "start", messageId: "m1" },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: "Here is a query you can run." },
  { type: "text-end", id: "t1" },
  { type: "tool-input-available", toolCallId: "c9", toolName: "propose_sql", input: { sql } },
  { type: "tool-output-available", toolCallId: "c9", output: { sql } },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
];
await page.route(/\/api\/chat$/, (route) =>
  route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(chunks) }),
);

await page.goto(base + "/connections/e2e-sqlite/ai", { waitUntil: "domcontentloaded" });
await page.getByTestId("ai-chat-page").waitFor({ timeout: 60000 });
// Consent can re-render under vite dev; click until it actually goes away.
for (let i = 0; i < 10; i += 1) {
  const consent = page.getByTestId("ai-schema-sharing-consent");
  if (!(await consent.isVisible().catch(() => false))) break;
  await consent.click().catch(() => {});
  await page.waitForTimeout(300);
}
const input = page.getByTestId("ai-chat-input");
await input.waitFor({ state: "visible", timeout: 40000 });
await input.fill("run a count for me");
await page.getByTestId("ai-chat-send").click();
await page
  .locator('[data-testid="ai-chat-message"][data-role="assistant"] summary')
  .filter({ hasText: "propose sql" })
  .first()
  .click({ timeout: 20000 });
console.log("expanding tool group, clicking Run");
await page.getByTestId("ai-chat-run-sql").click({ timeout: 20000 });
await page.waitForURL(/connections\/e2e-sqlite/, { timeout: 30000 });
console.log("navigated. sampling state...");
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(2000);
  const monaco = await page.getByTestId("sql-monaco-panel").isVisible().catch(() => false);
  const generating = await page.getByText("Generating SQL query...").isVisible().catch(() => false);
  const executing = await page.getByText("Executing SQL query...").isVisible().catch(() => false);
  const results = await page
    .locator('input[placeholder="r.name.includes(\'test\')"]')
    .isVisible()
    .catch(() => false);
  console.log("t+" + (i + 1) * 2 + "s monaco=" + monaco + " gen=" + generating + " exec=" + executing + " results=" + results);
}
console.log("fn calls:", JSON.stringify(fnCalls, null, 1));
await browser.close();
