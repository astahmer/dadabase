import { expect } from "@playwright/test";

import { Then } from "./fixtures";

Then("I should see the table filter", async ({ page }) => {
  await expect(page.getByPlaceholder("Filter tables...")).toBeVisible({ timeout: 45_000 });
});

Then("I should not see text {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
});
