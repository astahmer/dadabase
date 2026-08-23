import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

When("I collapse the sidebar", async ({ page }) => {
  const toggle = page.getByTestId("toggle-sidebar");
  await expect(toggle).toBeVisible();
  const sidebar = page.getByTestId("connection-sidebar");
  await expect(sidebar).toBeVisible();
  const before = await sidebar.boundingBox();
  expect(before?.width ?? 0).toBeGreaterThan(100);
  await toggle.click();
});

Then("the sidebar should be fully collapsed", async ({ page }) => {
  const sidebar = page.getByTestId("connection-sidebar");
  await expect
    .poll(async () => {
      const box = await sidebar.boundingBox();
      return box?.width ?? 0;
    })
    .toBeLessThan(8);
  await expect(page.getByTestId("toggle-sidebar")).toHaveAttribute("aria-label", "Show sidebar");
});

When("I open the AI assistant", async ({ page }) => {
  // AI button lives in the sidebar rail — ensure sidebar is open
  const toggle = page.getByTestId("toggle-sidebar");
  if ((await toggle.getAttribute("aria-label")) === "Show sidebar") {
    await toggle.click();
  }
  await page.getByTestId("open-ai-assistant").click();
  await expect(page.getByTestId("ai-assistant-drawer")).toBeVisible({ timeout: 10_000 });
});

Then("the AI assistant should mention the whole database schema", async ({ page }) => {
  const hint = page.getByTestId("ai-schema-context-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(/whole database schema/i);
  await expect(hint).toContainText(/tables/i);
});

Given("I store a fake OpenAI API key in localStorage", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "dadabase.openai-api-key",
      JSON.stringify("sk-e2e-fake-key-not-real-0000"),
    );
  });
});

Then("I should see text {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
});

When("I expand the SQL query panel", async ({ page }) => {
  const toggle = page.getByTestId("sql-query-toggle");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  // Portal may render the toggle in the filters bar; click to expand if collapsed
  const monaco = page.getByTestId("sql-monaco-panel");
  if (!(await monaco.isVisible().catch(() => false))) {
    await toggle.click();
  }
  await expect(monaco).toBeVisible({ timeout: 10_000 });
});

Then("I should see the unified SQL editor", async ({ page }) => {
  await expect(page.getByTestId("sql-query-editor")).toBeVisible();
  await expect(page.getByTestId("sql-monaco-panel")).toBeVisible();
  await expect(page.getByTestId("sql-run-button")).toBeVisible();
});

Then("I should not see Preview or Editor mode tabs", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Editor" })).toHaveCount(0);
});

When("I open the SQL snippets menu", async ({ page }) => {
  await page.getByTestId("sql-snippets-menu").click();
  await expect(page.getByTestId("sql-snippets-menu-content")).toBeVisible({ timeout: 5_000 });
});

Then("the SQL snippets menu content should be near the trigger", async ({ page }) => {
  const trigger = page.getByTestId("sql-snippets-menu");
  const content = page.getByTestId("sql-snippets-menu-content");
  await expect(content).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).toBeTruthy();
  expect(contentBox).toBeTruthy();

  // Must not be stuck at the viewport top-left (the reported bug)
  expect(contentBox!.x).toBeGreaterThan(40);
  expect(contentBox!.y).toBeGreaterThan(40);

  // Anchored near the trigger (within a generous radius)
  const dx = Math.abs(contentBox!.x - triggerBox!.x);
  const dy = Math.abs(contentBox!.y - (triggerBox!.y + triggerBox!.height));
  expect(dx).toBeLessThan(320);
  expect(dy).toBeLessThan(80);
});

When("I open saved queries", async ({ page }) => {
  await page.getByTestId("query-favorites-toggle").click();
});

When("I open the saved query SQL workspace", async ({ page }) => {
  await page.getByRole("button", { name: "Open SQL editor", exact: true }).click();
});

Then("I should not see column header filters for expand or select columns", async ({ page }) => {
  await expect(page.getByTestId("column-header-filter-__expand")).toHaveCount(0);
  await expect(page.getByTestId("column-header-filter-__select")).toHaveCount(0);
  await expect(page.getByTestId("column-header-filter-__actions")).toHaveCount(0);
});

Then(
  "I should see a column header filter for column {string}",
  async ({ page }, column: string) => {
    await expect(page.getByTestId(`column-header-filter-${column}`)).toBeVisible();
  },
);

When("I open the table filter builder", async ({ page }) => {
  await page.getByRole("button", { name: "Filter", exact: true }).click();
});

Then("I should see the compact filter workbench", async ({ page }) => {
  const workbench = page.getByRole("dialog").filter({ hasText: "Filter rows" });
  await expect(workbench.getByRole("heading", { name: "Filter rows" })).toBeVisible();
  await expect(workbench.getByText("No filter conditions yet", { exact: true })).toBeVisible();
  await expect(workbench.getByRole("button", { name: "Add filter", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

When("I open the join builder", async ({ page }) => {
  await page.getByRole("button", { name: "Join tables", exact: true }).click();
});

Then("I should see the inline join workspace", async ({ page }) => {
  const workspace = page.getByLabel("Join workspace");
  await expect(workspace.getByRole("heading", { name: "Join tables" })).toBeVisible();
  await expect(workspace.getByText("Related tables", { exact: true })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table")).toBeVisible();
});

When("I hover the relationships expand button for the first row", async ({ page }) => {
  const expand = page.locator('[data-testid^="row-expand-"]').first();
  await expect(expand).toBeVisible({ timeout: 15_000 });
  await expand.hover();
});

Then("I should see a tooltip containing {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
});

When("I refresh the table rows", async ({ page }) => {
  await page.getByTestId("table-refresh-button").click();
});

Then(
  "I should still see cell value {string} in column {string} while refreshing",
  async ({ page }, value: string, column: string) => {
    // Cell must remain mounted (not replaced by full-page spinner)
    const cell = page.getByTestId(`data-cell-${column}`).filter({ hasText: value }).first();
    await expect(cell).toBeVisible({ timeout: 10_000 });
  },
);

Then("the table body should not show loading skeletons", async ({ page }) => {
  await expect(page.locator("tr[data-skeleton]")).toHaveCount(0);
});

Then("the refresh button tooltip should not mention 1970", async ({ page }) => {
  const refresh = page.getByTestId("table-refresh-button");
  await expect(refresh).toBeVisible({ timeout: 15_000 });
  await refresh.hover();
  const tip = page.getByText(/Refresh rows/i).first();
  await expect(tip).toBeVisible({ timeout: 5_000 });
  await expect(tip).not.toContainText("1970");
});

Then("I should not see a Detach button", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^Detach$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Detached$/i })).toHaveCount(0);
});

Given("the query logger panel is expanded", async ({ page }) => {
  const toggle = page.getByTestId("toggle-query-logger");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  if ((await toggle.getAttribute("aria-label")) === "Expand query logger") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-label", "Collapse query logger");
});

When("I enable zen mode", async ({ page }) => {
  await page
    .getByRole("button", { name: /Enter zen mode/i })
    .first()
    .click();
});

Then("the query logger panel should be collapsed", async ({ page }) => {
  const panel = page.getByTestId("query-logger-splitter-panel");
  await expect(panel).toHaveAttribute("data-zen-collapsed", "true");
  await expect(panel).toBeHidden();
});

Then("the connection page header should be hidden", async ({ page }) => {
  await expect(page.getByTestId("connection-page-header")).toHaveCount(0);
});

When("I resize the viewport to {int} by {int}", async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height });
});

Then("I can reach the order-by button in the filters toolbar", async ({ page }) => {
  const toolbar = page.getByTestId("connection-page-filters-toolbar");
  const orderBy = page.getByTestId("order-by-button");
  await expect(toolbar).toBeVisible();
  await orderBy.scrollIntoViewIfNeeded();
  await expect(orderBy).toBeVisible();
  const box = await orderBy.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(8);
});
