import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Given, Then, When } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathsFile = path.join(__dirname, "../../.tmp/paths.json");

Given("I open the connections home page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Database Connections" })).toBeVisible();
  // TanStack Start hydrates the SSR shell after the page is visible. Wait for the
  // client bundle before operating the form; network-idle never settles because
  // the app maintains background queries.
  await page.waitForTimeout(3_000);
});

// H1: the creation form collapsed behind a CTA — scenarios operating the form
// must open it explicitly so list-only scenarios keep an uninert background.
Given("I open the new connection form", async ({ page }) => {
  await page.getByTestId("new-connection-cta").click();
  await expect(page.getByTestId("connection-save")).toBeVisible();
});

When("I open the new connection page directly", async ({ page }) => {
  await page.goto("/connections/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "New connection" })).toBeVisible();
  await page.waitForTimeout(3_000);
});

Then("I should see the heading {string}", async ({ page }, heading: string) => {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
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
    await expect(page.getByRole("row", { name: new RegExp(connectionName) })).toBeVisible({
      timeout: 15_000,
    });
  },
);

Then(
  "the saved connection {string} should be read-only",
  async ({ page }, connectionName: string) => {
    await expect(page.getByTestId(`connection-safety-${connectionName}`)).toHaveText("Read-only");
  },
);

Then("I should see a read-only saved connection", async ({ page }) => {
  await expect(page.getByText("Read-only", { exact: true }).first()).toBeVisible();
});

When("I search saved connections for {string}", async ({ page }, query: string) => {
  await page.getByRole("textbox", { name: "Search saved connections" }).fill(query);
});

Then(
  "I should not see the saved connection named {string}",
  async ({ page }, connectionName: string) => {
    await expect(page.getByRole("row", { name: new RegExp(connectionName) })).toHaveCount(0);
  },
);
