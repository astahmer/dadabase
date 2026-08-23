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
  const editor = page.getByTestId("sql-monaco-panel").locator(".monaco-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(sql);
  await page.getByTestId("sql-run-button").click();
});

Then("I should see custom SQL cell value {string}", async ({ page }, value: string) => {
  await expect(page.getByText(value, { exact: true })).toBeVisible({ timeout: 30_000 });
});
