import { expect } from "@playwright/test";

import { Then } from "./fixtures";

Then("the SQL monaco panel should be hidden", async ({ page }) => {
  await expect(page.getByTestId("sql-monaco-panel")).toHaveCount(0);
});

Then("I should see the SQL query toggle", async ({ page }) => {
  await expect(page.getByTestId("sql-query-toggle")).toBeVisible({ timeout: 15_000 });
});
