import { expect } from "@playwright/test";

import { Given, Then } from "./fixtures";

Then("I should see the table filter", async ({ page }) => {
  await expect(page.getByPlaceholder("Filter tables...")).toBeVisible({ timeout: 45_000 });
});

Then("I should not see text {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
});

Given("I open the connection named {string}", async ({ page }, connectionName: string) => {
  await page.goto(`/connections/${connectionName}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page).toHaveURL(new RegExp(`/connections/${connectionName}`));
});

Then(
  "I should see a connection load error matching {string}",
  async ({ page }, pattern: string) => {
    const re = new RegExp(pattern, "i");
    // ErrorBoundaryCard + LoadingSpinner failure text live in the sidebar.
    await expect
      .poll(
        async () => {
          const body = await page.locator("body").innerText();
          return re.test(body);
        },
        { timeout: 45_000 },
      )
      .toBe(true);
  },
);
