import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

When("I open the custom SQL workspace", async ({ page }) => {
  await page.getByRole("button", { name: "Custom SQL", exact: true }).click();
});

Then("I should see the table-independent SQL workspace", async ({ page }) => {
  await expect(page.getByTestId("custom-sql-workspace")).toBeVisible();
  await expect(page.getByTestId("custom-sql-workspace")).toContainText("e2e-sqlite");
  await expect(page.getByTestId("custom-sql-workspace")).toContainText("Writes enabled");
  await expect(page.getByTestId("sql-query-editor")).toBeVisible();
});

When("I run custom SQL {string}", async ({ page }, sql: string) => {
  await enterCustomSql(page, sql);
  await page.getByTestId("sql-run-button").click();
  const destructiveConfirm = page.getByRole("button", { name: "Execute", exact: true });
  if (await destructiveConfirm.isVisible().catch(() => false)) {
    await destructiveConfirm.click();
  }
  await expect(
    page
      .getByTestId("sql-result-receipt")
      .or(page.getByText("Query executed successfully", { exact: true })),
  ).toBeVisible({ timeout: 30_000 });
});

When("I run the current SQL from the editor", async ({ page }) => {
  await page.getByTestId("sql-run-button").click();
  const destructiveConfirm = page.getByRole("button", { name: "Execute", exact: true });
  if (await destructiveConfirm.isVisible().catch(() => false)) {
    await destructiveConfirm.click();
  }
});

When("I toggle the query logger panel size", async ({ page }) => {
  const panel = page.getByTestId("query-logger-splitter-panel");
  const splitter = panel.locator("xpath=preceding-sibling::*[1]");
  await expect(splitter).toBeVisible();
  await splitter.dblclick();
});

When("I choose the SQL layout {string}", async ({ page }, layout: string) => {
  await page.getByTestId("sql-maximize-menu").click();
  await page.getByRole("menuitem", { name: layout, exact: true }).click();
});

When("I enter custom SQL {string}", async ({ page }, sql: string) => {
  await enterCustomSql(page, sql);
});

async function enterCustomSql(page: import("@playwright/test").Page, sql: string) {
  const editor = page.getByTestId("sql-monaco-panel").locator(".monaco-editor");
  await expect(page.getByTestId("sql-monaco-editor-loading")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(sql);
  await expect(editor.locator(".view-lines")).toContainText(sql);
}

When("I save the current SQL as a favorite", async ({ page }) => {
  await page.getByRole("button", { name: "SQL tools" }).click();
  await page.getByRole("menuitem", { name: "Save to favorites" }).click();
  await expect(page.getByText("Query saved to favorites", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

When("I run the current SQL as a transaction", async ({ page }) => {
  await page.getByRole("button", { name: "SQL tools" }).click();
  await page.getByRole("menuitem", { name: /Run all atomically/ }).click();
});

When("I pin the current SQL result", async ({ page }) => {
  await page.getByTestId("sql-pin-current-result").click();
  await expect(page.getByTestId("sql-pinned-results")).toBeVisible();
});

When("I begin a persistent transaction", async ({ page }) => {
  await page.getByTestId("sql-transaction-controls").click();
  await page.getByRole("menuitem", { name: "Begin transaction", exact: true }).click();
  await expect(page.getByText("Transaction started", { exact: true }).last()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("sql-transaction-controls")).toContainText("Transaction active");
});

When("I commit the persistent transaction", async ({ page }) => {
  await page.getByTestId("sql-transaction-controls").click();
  await page.getByRole("menuitem", { name: "Commit transaction", exact: true }).click();
  await expect(page.getByText("Transaction committed", { exact: true }).last()).toBeVisible({
    timeout: 15_000,
  });
});

When("I roll back the persistent transaction", async ({ page }) => {
  await page.getByTestId("sql-transaction-controls").click();
  await page.getByRole("menuitem", { name: "Rollback transaction", exact: true }).click();
  await expect(page.getByText("Transaction rolled back", { exact: true }).last()).toBeVisible({
    timeout: 15_000,
  });
});

Then("the SQL editor should retain {string}", async ({ page }, sql: string) => {
  await expect(page.getByTestId("sql-monaco-panel").locator(".view-lines")).toContainText(sql);
});

Then("I should see a saved favorite titled {string}", async ({ page }, title: string) => {
  await expect(
    page
      .getByTestId("query-favorite-row")
      .getByTestId("query-favorite-title")
      .filter({ hasText: title }),
  ).toBeVisible({ timeout: 15_000 });
});

When("I click the saved favorite title {string}", async ({ page }, title: string) => {
  await page.getByTestId("query-favorite-title").filter({ hasText: title }).click();
});

Then("I should see custom SQL cell value {string}", async ({ page }, value: string) => {
  await expect(
    page.locator('[data-testid^="cell-"]').filter({ hasText: value }).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
});

Then("I should see a custom SQL result receipt", async ({ page }) => {
  await expect(page.getByTestId("sql-result-receipt")).toContainText("rows returned");
  await expect(page.getByTestId("sql-result-receipt")).toContainText("ms");
});

Then("I should see a SQL request ID", async ({ page }) => {
  await expect(page.getByTestId("sql-request-id")).toBeVisible();
});

Then("I should see the SQL execution timeline", async ({ page }) => {
  await expect(page.getByTestId("sql-execution-timeline")).toContainText("Execution timeline");
});

Then("I should see a pinned SQL result containing {string}", async ({ page }, sql: string) => {
  await expect(page.getByTestId("sql-pinned-results")).toContainText(sql);
});

Then("I should not see crash-specific SQL draft recovery", async ({ page }) => {
  await expect(page.getByTestId("sql-draft-crash-recovered")).toHaveCount(0);
});

Then("a fresh page should offer crash-specific SQL draft recovery", async ({ page }) => {
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("dadabase:sql-session:"));
    if (!key) throw new Error("SQL session marker was not created");
    const value = JSON.parse(localStorage.getItem(key) ?? "{}");
    localStorage.setItem(
      key,
      JSON.stringify({ ...value, sessionId: "interrupted-e2e-session", cleanExit: false }),
    );
  });
  const freshPage = await page.context().newPage();
  try {
    await freshPage.goto(page.url());
    await expect(freshPage.getByTestId("sql-draft-crash-recovered")).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await freshPage.close();
  }
});

Then("the SQL editor actions should fit the narrow viewport", async ({ page }) => {
  const actions = page.getByTestId("sql-editor-actions");
  const actionsBox = await actions.boundingBox();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(391);
  await expect(page.getByTestId("sql-run-button")).toBeVisible();
});

Then(
  "the custom SQL workspace matches the {string} visual snapshot",
  async ({ page }, name: string) => {
    await expect(page.getByTestId("custom-sql-workspace")).toHaveScreenshot(
      `custom-sql-${name}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.03,
      },
    );
  },
);

Then("the current result should be marked stale", async ({ page }) => {
  await expect(page.getByTestId("sql-result-stale")).toContainText(
    "Draft changed since this result was run",
  );
  await expect(
    page.getByTestId("sql-result-stale").getByRole("button", { name: "Run draft" }),
  ).toBeVisible();
});
