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

When("I restore the sidebar", async ({ page }) => {
  await page.getByTestId("toggle-sidebar").click();
});

Then("the hidden sidebar has no visible table navigation", async ({ page }) => {
  const sidebar = page.getByTestId("connection-sidebar");
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect(sidebar.getByRole("option", { name: "users", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Show sidebar", exact: true })).toBeVisible();
});

Then("the table sidebar navigation is visible", async ({ page }) => {
  const sidebar = page.getByTestId("connection-sidebar");
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  await expect(sidebar.getByRole("option", { name: "users", exact: true })).toBeVisible();
});

Then("the new-tab table search is focused", async ({ page }) => {
  await expect(page.getByTestId("empty-tab-search-input")).toBeFocused();
});

When("I filter new-tab tables to {string}", async ({ page }, query: string) => {
  const input = page.getByTestId("empty-tab-search-input");
  await input.fill(query);
  await expect(page.getByTestId(`empty-tab-option-${query}`)).toBeVisible();
});

When("I open the highlighted table with the keyboard", async ({ page }) => {
  const input = page.getByTestId("empty-tab-search-input");
  await input.press("ArrowDown");
  await input.press("Enter");
});

Then("the active table tab is {string}", async ({ page }, table: string) => {
  await expect(
    page.locator('[data-table-tab][data-table-tab-active="true"]').filter({ hasText: table }),
  ).toBeVisible();
});

Then("the bulk selection header has no visible Select label", async ({ page }) => {
  const checkbox = page.getByRole("checkbox", { name: "Select all rows", exact: true });
  await expect(checkbox).toBeVisible();
  const header = checkbox.locator("xpath=ancestor::th");
  await expect(header).toBeVisible();
  await expect(header).not.toContainText("Select", { useInnerText: true });
});
