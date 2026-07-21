import { expect } from "@playwright/test";

import { Then, When } from "./fixtures";

When("I switch to structure view", async ({ page }) => {
  await page.getByTestId("view-mode-structure").click();
  await expect(page.getByTestId("schema-create-table")).toBeVisible({ timeout: 10_000 });
});

When(
  "I create a table named {string} with an id primary key",
  async ({ page }, tableName: string) => {
    await page.getByTestId("schema-create-table").click();
    await expect(page.getByTestId("schema-mutate-sheet")).toBeVisible();
    await page.getByTestId("schema-mutate-table-name").fill(tableName);
    // Default form already has id PK row
    await page.getByTestId("schema-mutate-run").click();
    await expect(page.getByTestId("schema-mutate-sheet")).toBeHidden({ timeout: 15_000 });
  },
);

Then("I should see table {string} in the sidebar", async ({ page }, tableName: string) => {
  const filter = page.getByPlaceholder("Filter tables...");
  await filter.fill(tableName);
  const tableItem = page.locator("[data-tables-list]").getByText(tableName, { exact: true });
  await expect(tableItem).toBeVisible({ timeout: 20_000 });
});

Then("I should not see table {string} in the sidebar", async ({ page }, tableName: string) => {
  const filter = page.getByPlaceholder("Filter tables...");
  await filter.fill(tableName);
  const tableItem = page.locator("[data-tables-list]").getByText(tableName, { exact: true });
  await expect(tableItem).toHaveCount(0, { timeout: 20_000 });
});

When(
  "I add a column named {string} with type {string}",
  async ({ page }, columnName: string, dataType: string) => {
    // Ensure we're on the new table's structure view
    await expect(page.getByTestId("schema-add-column")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("schema-add-column").click();
    await expect(page.getByTestId("schema-mutate-sheet")).toBeVisible();
    await page.getByTestId("schema-mutate-col-name").fill(columnName);
    await page.getByTestId("schema-mutate-col-type").fill(dataType);
    await page.getByTestId("schema-mutate-run").click();
    await expect(page.getByTestId("schema-mutate-sheet")).toBeHidden({ timeout: 15_000 });
  },
);

Then(
  "I should see column {string} in the structure table",
  async ({ page }, columnName: string) => {
    await expect(page.getByTestId(`schema-column-actions-${columnName}`)).toBeVisible({
      timeout: 15_000,
    });
  },
);

Then(
  "I should not see column {string} in the structure table",
  async ({ page }, columnName: string) => {
    await expect(page.getByTestId(`schema-column-actions-${columnName}`)).toHaveCount(0, {
      timeout: 15_000,
    });
  },
);

When("I drop column {string}", async ({ page }, columnName: string) => {
  await page.getByTestId(`schema-column-actions-${columnName}`).click();
  await page.getByTestId(`schema-column-drop-${columnName}`).click();
  // Confirm destructive dialog
  await page.getByRole("button", { name: "Execute" }).click();
  await expect(page.getByTestId(`schema-column-actions-${columnName}`)).toHaveCount(0, {
    timeout: 15_000,
  });
});

When("I drop the current table", async ({ page }) => {
  await page.getByTestId("schema-drop-table").click();
  await page.getByRole("button", { name: "Execute" }).click();
});

When(
  "I alter column {string} to type {string}",
  async ({ page }, columnName: string, dataType: string) => {
    // The structure table can re-render shortly after the view mounts (layout
    // settling, index list loading), which detaches an already-open menu.
    // Retry opening the menu until the edit item can be clicked reliably.
    const actionsButton = page.getByTestId(`schema-column-actions-${columnName}`);
    await expect(actionsButton).toBeVisible({ timeout: 15_000 });
    let opened = false;
    for (let attempt = 0; attempt < 10 && !opened; attempt++) {
      await actionsButton.click();
      const editItem = page
        .getByTestId(`schema-column-edit-${columnName}`)
        .or(page.getByRole("menuitem", { name: "Edit column" }));
      try {
        await editItem.click({ timeout: 3_000 });
        opened = true;
      } catch {
        await page.keyboard.press("Escape");
      }
    }
    if (!opened) {
      throw new Error(`Could not open edit sheet for column "${columnName}"`);
    }
    await expect(page.getByTestId("schema-mutate-sheet")).toBeVisible();
    await page.getByTestId("schema-mutate-col-type").fill(dataType);
    await page.getByTestId("schema-mutate-run").click();
    await page.getByRole("button", { name: "Execute" }).click();
    await expect(page.getByTestId("schema-mutate-sheet")).toBeHidden({ timeout: 15_000 });
  },
);
