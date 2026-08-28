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
  // The assistant is a first-class page now (drawer retired)
  await expect(page.getByTestId("ai-chat-page")).toBeVisible({ timeout: 10_000 });
});

Then("the AI assistant should mention the whole database schema", async ({ page }) => {
  const hint = page.getByTestId("ai-schema-context-hint");
  await expect(hint).toBeVisible();
  // Schema introspection is async — wait for the loaded copy.
  await expect(hint).toContainText(/whole database schema/i, { timeout: 20_000 });
  await expect(hint).toContainText(/tables/i);
});

Then("the AI assistant should require schema-sharing approval", async ({ page }) => {
  const consent = page.getByTestId("ai-schema-sharing-consent");
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
  await expect(
    page.getByText("Dadabase sends this prompt plus schema, table, and column names", {
      exact: false,
    }),
  ).toBeVisible();
});

Then("the send button unlocks for a typed draft", async ({ page }) => {
  // Empty drafts intentionally disable send; typing must enable it.
  await page.getByTestId("ai-chat-input").fill("SELECT 1");
  await expect(page.getByTestId("ai-chat-send")).toBeEnabled({ timeout: 15_000 });
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
  // Prefer a visible match: pages render hidden copies of common words (e.g.
  // query-history disclaimers) that .first() would otherwise pick up.
  const visible = page.getByText(text, { exact: false }).locator("visible=true").first();
  await expect(visible).toBeVisible({ timeout: 15_000 });
});

When("I expand the SQL query panel", async ({ page }) => {
  const toggle = page.getByTestId("sql-query-toggle");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  // Portal may render the toggle in the filters bar; click to expand if collapsed
  const monaco = page.getByTestId("sql-monaco-panel");
  const editor = monaco.locator(".monaco-editor");
  if (!(await editor.isVisible().catch(() => false))) {
    await toggle.click();
  }
  await expect(page.getByTestId("sql-monaco-editor-loading")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(editor).toBeVisible({ timeout: 10_000 });
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
  await expect(workbench.getByPlaceholder("Column")).toBeVisible();
  await expect(workbench.getByRole("button", { name: "Quick query", exact: false })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

When("I apply the incomplete filter draft", async ({ page }) => {
  await page.getByTestId("apply-filters").click();
});

Then("I should be told to finish the filter before it is shared", async ({ page }) => {
  await expect(page.getByText("Finish the filter first", { exact: true })).toBeVisible();
  await expect(page.getByTestId("apply-filters")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("filters")).toBe(false);
});

When(
  "I apply filters for age greater than {string} and active equal to {string}",
  async ({ page }, age: string, active: string) => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();

    const selectColumn = async (index: number, value: string) => {
      const column = page.getByRole("combobox", { name: "Column", exact: true }).nth(index);
      await column.fill(value);
      await page.getByRole("option", { name: new RegExp(`^${value} `) }).click();
    };

    await selectColumn(0, "age");
    const operator = page.getByRole("combobox", { name: "Operator", exact: true }).first();
    await operator.fill("greater than");
    await page
      .getByRole("option", { name: /greater than/i })
      .first()
      .click();
    await page.getByRole("textbox", { name: "Value", exact: true }).first().fill(age);

    await page.getByRole("button", { name: "Add filter", exact: true }).click();
    await selectColumn(1, "active");
    await page.getByRole("textbox", { name: "Value", exact: true }).nth(1).fill(active);
    await page.getByTestId("apply-filters").click();
  },
);

When(
  "I apply filters that match any of age greater than {string} or active equal to {string}",
  async ({ page }, age: string, active: string) => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();

    const selectColumn = async (index: number, value: string) => {
      const column = page.getByRole("combobox", { name: "Column", exact: true }).nth(index);
      await column.fill(value);
      await page.getByRole("option", { name: new RegExp(`^${value} `) }).click();
    };

    await selectColumn(0, "age");
    const operator = page.getByRole("combobox", { name: "Operator", exact: true }).first();
    await operator.fill("greater than");
    await page
      .getByRole("option", { name: /greater than/i })
      .first()
      .click();
    await page.getByRole("textbox", { name: "Value", exact: true }).first().fill(age);

    await page.getByRole("button", { name: "Add filter", exact: true }).click();
    await selectColumn(1, "active");
    await page.getByRole("textbox", { name: "Value", exact: true }).nth(1).fill(active);
    await page.getByRole("button", { name: "Any", exact: true }).click();
    await page.getByTestId("apply-filters").click();
  },
);

Then("I should see {int} filtered data row", async ({ page }, count: number) => {
  await expect(page.locator("tbody tr")).toHaveCount(count);
});

Then("the active filter summary should show {int} conditions", async ({ page }, count: number) => {
  await expect(page.getByRole("button", { name: new RegExp(`Filter\\s*${count}`) })).toBeVisible();
});

When("I add a grouping for {string}", async ({ page }, column: string) => {
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Add grouping", exact: true }).click();
  await page.getByRole("combobox", { name: "Add grouping column", exact: true }).click();
  await page.getByRole("option", { name: column, exact: true }).click();
});

Then("I should see {string} in the grouping controls", async ({ page }, column: string) => {
  await expect(
    page.getByRole("dialog").getByRole("button", { name: column, exact: true }),
  ).toBeVisible();
});

Then("the query logger should be hidden by default", async ({ page }) => {
  await expect(page.getByTestId("query-logger-splitter-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "Query history" })).toBeVisible();
});

When("I open query history", async ({ page }) => {
  await page.getByRole("button", { name: "Query history", exact: true }).click();
});

Then("I should see query-history privacy controls", async ({ page }) => {
  await expect(
    page.getByRole("textbox", { name: "Search query history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("History can contain sensitive SQL.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear query history", exact: true }),
  ).toBeVisible();
});

When("I open the dedicated schema explorer", async ({ page }) => {
  await page.goto("/schema/e2e-sqlite?schema=main");
});

When("I open the schema explorer page from the sidebar rail", async ({ page }) => {
  await page.getByTestId("open-schema-explorer-page").click();
  await expect(page).toHaveURL(/\/schema\/e2e-sqlite/);
});

Then("I should see the dedicated schema explorer", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Schema Explorer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to workspace" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter tables" })).toBeVisible();
  await expect(page.getByText("favorites", { exact: true })).toBeVisible();
});

When("I open the schema map", async ({ page }) => {
  await page.getByRole("button", { name: "Schema map", exact: true }).click();
});

Then("I should see schema-map navigation controls", async ({ page }) => {
  await expect(page.getByTestId("er-diagram-view")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoom in schema diagram", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoom out schema diagram", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit schema diagram", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export schema diagram as SVG", exact: true }),
  ).toBeVisible();
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

When("I add the favorites relationship", async ({ page }) => {
  // Selecting the suggested relationship in the listbox adds the join directly
  // (the old confirm-chip click was removed when the join dialog was reworked).
  await page.getByRole("option", { name: "favorites.user_id › users.id", exact: true }).click();
  await expect(page.getByRole("button", { name: /Remove join/ }).first()).toBeVisible();
});

Then("I should see the join result explanation", async ({ page }) => {
  // The explanation block lives in the joined row's accordion body — expand it.
  // .first() targets the outer trigger; the nested "Remove join" button comes later in DOM order.
  await page
    .getByRole("button", { name: /favorites ON .*favorites\.user_id/ })
    .first()
    .click();
  await expect(page.getByText("Result shape:", { exact: false })).toBeVisible();
  await expect(page.getByText("Match fields:", { exact: true })).toBeVisible();
  await expect(page.getByText("Generated SQL:", { exact: true })).toBeVisible();
  await expect(page.getByText("Result columns:", { exact: true })).toBeVisible();
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
  if (!(await toggle.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Query history" }).click();
  }
  await expect(toggle).toBeVisible({ timeout: 15_000 });
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

Then("the mobile sidebar should start collapsed", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Show sidebar", exact: true })).toBeVisible();
  await expect(page.getByTestId("connection-sidebar")).toHaveAttribute("data-collapsed", "true");
});

When("I open the mobile sidebar", async ({ page }) => {
  await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
});

Then("I should be able to browse tables in the mobile sidebar", async ({ page }) => {
  const sidebar = page.getByTestId("connection-sidebar");
  await expect(page.getByRole("button", { name: "Hide sidebar", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("option", { name: "users", exact: true })).toBeVisible();
});
