import { expect } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Given, Then, When } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathsFile = path.join(__dirname, "../../.tmp/paths.json");

const loadPaths = () =>
  JSON.parse(readFileSync(pathsFile, "utf8")) as {
    csvDir: string;
    peopleCsvPath: string;
  };

/** Rewrites the fixture csv (a previous scenario's Save may have mutated it). */
function resetCsvFixture() {
  const { peopleCsvPath } = loadPaths();
  const rows = [];
  for (let i = 1; i <= 10; i++) {
    const active = i === 4 ? "" : i % 2 === 0 ? "true" : "false";
    rows.push([i, `person_${i}`, active, (i * 1.5).toFixed(1)].join(","));
  }
  const content = `id,name,active,score\n${rows.join("\n")}\n`;
  writeFileSync(peopleCsvPath, content);
}

Given("I have a CSV connection named {string}", async ({ page }, connectionName: string) => {
  resetCsvFixture();

  await page.goto(`/connections/${connectionName}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page).toHaveURL(new RegExp(`/connections/${connectionName}`));
  await expect(page.getByPlaceholder("Filter tables...")).toBeVisible({ timeout: 45_000 });
});

Then(
  "I should see the CSV save bar with {int} unsaved changes",
  async ({ page }, count: number) => {
    const bar = page.getByTestId("csv-save-bar");
    await expect(bar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("csv-unsaved-count")).toHaveText(
      new RegExp(`^${count} unsaved changes?$`),
    );
  },
);

When("I commit the pending cell edits", async ({ page }) => {
  await page.getByRole("button", { name: "Commit…" }).click();
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible({ timeout: 10_000 });
  await review.getByRole("button", { name: "Save changes" }).click();
  await expect(review).toBeHidden({ timeout: 20_000 });
});

When("I save the CSV table to file", async ({ page }) => {
  await page.getByTestId("csv-save-button").click();
  // Bar disappears once the counter resets after a successful save.
  await expect(page.getByTestId("csv-save-bar")).toBeHidden({ timeout: 20_000 });
});

When("I reload the page", async ({ page }) => {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
});

function readPeopleCsv(): string {
  const { peopleCsvPath } = loadPaths();
  return readFileSync(peopleCsvPath, "utf8");
}

Then("the CSV file on disk should contain {string}", async ({}, fragment: string) => {
  expect(readPeopleCsv()).toContain(fragment);
});

Then("the CSV file on disk should not contain {string}", async ({}, fragment: string) => {
  expect(readPeopleCsv()).not.toContain(fragment);
});

Then(
  "a .bak backup for {string} should exist without {string}",
  async ({}, fileName: string, fragment: string) => {
    const { csvDir } = loadPaths();
    const bakPath = path.join(csvDir, `${fileName}.bak`);
    expect(existsSync(bakPath)).toBe(true);
    expect(readFileSync(bakPath, "utf8")).not.toContain(fragment);

    // No tmp litter left behind by the atomic swap.
    const tmpLeftovers = readdirSync(csvDir).filter((f) => f.includes(".tmp-"));
    expect(tmpLeftovers).toEqual([]);
  },
);
