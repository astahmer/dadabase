import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { test } from "./fixtures.ts";

const { When, Then } = createBdd(test);


When("I switch to the structure view", async ({ page }) => {
  await page.getByTestId("view-mode-structure").click();
  // Structure view renders column metadata headings.
  await expect(page.getByText("Data Type", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
});

Then("the structure view is active after load", async ({ page }) => {
  await expect(page.getByText("Data Type", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("view-mode-structure")).toHaveClass(/data-[a-z-]+=true|bg-primary/);
});

When("I go back", async ({ page }) => {
  await page.goBack();
  await page.waitForTimeout(500);
});

Then("the rows view is active", async ({ page }) => {
  await expect(page.getByTestId("view-mode-rows")).toBeVisible();
  await expect(page.locator('[data-testid^="data-cell-"]').first()).toBeVisible({
    timeout: 20_000,
  });
});

When("I click the edit button on the first row", async ({ page }) => {
  await page.getByTestId("row-edit-button").first().click();
});

When("I double-click the first data cell", async ({ page }) => {
  await page.locator('[data-testid^="data-cell-"]').first().dblclick();
});

Then("the URL contains the structure view mode", async ({ page }) => {
  const url = decodeURIComponent(page.url());
  expect(url).toMatch(/viewMode[=:&\"']*structure/);
});

Then("the row editor sheet should be visible", async ({ page }) => {
  await expect(page.getByTestId("row-editor-sheet")).toBeVisible({ timeout: 10_000 });
});

Then(
  "the pagination controls have accessible names and boundary hints",
  async ({ page }) => {
    const prev = page.getByRole("button", { name: "Previous page" }).first();
    const next = page.getByRole("button", { name: "Next page" }).first();
    await expect(prev).toBeVisible();
    await expect(next).toBeVisible();
    // Boundary hint must exist even when the control is disabled.
    expect(await prev.getAttribute("title")).toBeTruthy();
    expect(await next.getAttribute("title")).toBeTruthy();
  },
);

Then("no unnamed icon buttons remain on the grid surface", async ({ page }) => {
  const unnamed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(
        (b) =>
          !b.textContent.trim() &&
          !b.getAttribute("aria-label") &&
          !b.getAttribute("title") &&
          !b.getAttribute("aria-labelledby"),
      )
      .map((b) => b.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});

Then("the connection switcher trigger has an accessible name", async ({ page }) => {
  await expect(page.getByLabel("Switch connection")).toBeVisible();
});
