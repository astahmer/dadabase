import { expect } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

Given(
  "I have a SQLite sample database connection named {string}",
  async ({ page }, connectionName: string) => {
    await page.goto(`/connections/${connectionName}`);
    await expect(page).toHaveURL(new RegExp(`/connections/${connectionName}`));
    // Sidebar tables filter is a reliable signal the connection page loaded
    await expect(page.getByPlaceholder("Filter tables...")).toBeVisible({ timeout: 30_000 });
  },
);

Given("I open the {string} table", async ({ page }, tableName: string) => {
  const filter = page.getByPlaceholder("Filter tables...");
  await expect(filter).toBeVisible({ timeout: 20_000 });
  await filter.fill(tableName);
  const tableItem = page.locator("[data-tables-list]").getByText(tableName, { exact: true });
  await expect(tableItem).toBeVisible({ timeout: 15_000 });
  await tableItem.click();
  await expect(page.getByTestId("add-row-button")).toBeVisible({ timeout: 20_000 });
});

When("I click Add row", async ({ page }) => {
  await page.getByTestId("add-row-button").click();
  await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
});

When(
  "I fill the row editor field {string} with {string}",
  async ({ page }, fieldName: string, value: string) => {
    const field = page.getByTestId(`column-input-${fieldName}`);
    await expect(field).toBeVisible();

    const defaultBtn = field.getByRole("button", { name: "Default" });
    if (await defaultBtn.isVisible().catch(() => false)) {
      if ((await defaultBtn.getAttribute("class"))?.includes("bg-primary")) {
        await defaultBtn.click();
      }
    }

    const nullBtn = field.getByRole("button", { name: "NULL" });
    if (await nullBtn.isVisible().catch(() => false)) {
      if ((await nullBtn.getAttribute("class"))?.includes("bg-primary")) {
        await nullBtn.click();
      }
    }

    const input = field.locator("input, textarea").first();
    await input.fill(value);
  },
);

When("I save the row editor", async ({ page }) => {
  await page.getByTestId("row-editor-save").click();
  await expect(page.getByTestId("row-editor-sheet")).toBeHidden({ timeout: 15_000 });
});

When(
  "I open the edit sheet for the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();

    const row = cell.locator("xpath=ancestor::tr[1]");
    const rowNumber = row.getByRole("button").first();
    await rowNumber.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit row" }).click();
    await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
  },
);

When(
  "I double-click the cell in column {string} for the row with {string}",
  async ({ page }, columnName: string, cellValue: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();
    await cell.dblclick();
    await expect(page.getByTestId("inline-cell-editor")).toBeVisible();
  },
);

When("I type {string} into the inline editor and press Enter", async ({ page }, value: string) => {
  const editor = page.getByTestId("inline-cell-editor").locator("input");
  await editor.fill(value);
  await editor.press("Enter");
  await expect(page.getByTestId("inline-cell-editor")).toBeHidden({ timeout: 15_000 });
});

Then(
  "I should see cell value {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    await expect(
      page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first(),
    ).toBeVisible({ timeout: 15_000 });
  },
);
