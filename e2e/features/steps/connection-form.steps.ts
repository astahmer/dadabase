import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Given, Then, When } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathsFile = path.join(__dirname, "../../.tmp/paths.json");

Given("I open the connections home page", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Database Connections" })).toBeVisible();
});

Then("the new connection should default to read-only", async ({ page }) => {
  const readOnly = page.getByTestId("connection-readonly-checkbox");
  await expect(readOnly).toBeChecked();

  // The page is SSR'd. Wait for a stateful interaction before testing form
  // submission so the assertion exercises the hydrated form, not static HTML.
  await readOnly.uncheck();
  await expect(readOnly).not.toBeChecked();
  await readOnly.check();
  await expect(readOnly).toBeChecked();
});

Then("SQLite connections should default to read-only", async ({ page }) => {
  await page.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "SQLite", exact: true }).click();
  await expect(page.getByTestId("connection-readonly-checkbox")).toBeChecked();
});

When("I save the blank connection form", async ({ page }) => {
  await page.getByTestId("connection-save").click();
});

When("I save a SQLite connection named {string}", async ({ page }, connectionName: string) => {
  const { sampleDbPath } = JSON.parse(readFileSync(pathsFile, "utf8")) as {
    sampleDbPath: string;
  };

  if (
    !(await page
      .getByLabel("File Path")
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "SQLite", exact: true }).click();
  }
  await page.getByLabel("Name").fill(connectionName);
  await page.getByLabel("File Path").fill(sampleDbPath);
  await page.getByTestId("connection-save").click();
});

Then(
  "I should see the saved connection named {string}",
  async ({ page }, connectionName: string) => {
    await expect(page.getByRole("link", { name: connectionName })).toBeVisible({ timeout: 15_000 });
  },
);
