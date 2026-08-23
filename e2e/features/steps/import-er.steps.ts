import { expect } from "@playwright/test";

import { Then, When } from "./fixtures";

When("I switch to ER diagram view", async ({ page }) => {
  await page.getByTestId("view-mode-er").click();
  await expect(page.getByTestId("er-diagram-view")).toBeVisible({ timeout: 15_000 });
});

Then("I should see ER table node {string}", async ({ page }, tableName: string) => {
  await expect(page.getByTestId(`er-table-${tableName}`)).toBeVisible({ timeout: 15_000 });
});

Then(
  "I should see ER column {string} on table {string}",
  async ({ page }, columnName: string, tableName: string) => {
    await expect(page.getByTestId(`er-column-${tableName}-${columnName}`)).toBeVisible({
      timeout: 15_000,
    });
  },
);

When("I import CSV rows into the current table:", async ({ page }, docString: string) => {
  await page.getByTestId("import-data").click();
  await expect(page.getByTestId("import-data-sheet")).toBeVisible();

  const fileInput = page.getByTestId("import-file-input");
  await fileInput.setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`${docString.trim()}\n`, "utf8"),
  });

  await expect(page.getByTestId("import-sql-preview")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("import-run").click();
  await expect(page.getByTestId("import-data-sheet")).toBeHidden({ timeout: 20_000 });
});

Then("I should see {string} in the rows table", async ({ page }, text: string) => {
  await page.getByTestId("view-mode-rows").click();
  await expect(page.getByTestId("import-data-sheet"))
    .toBeHidden({ timeout: 5_000 })
    .catch(() => undefined);
  await expect(page.locator('[data-in="CellValue"]').filter({ hasText: text })).toBeVisible({
    timeout: 20_000,
  });
});
