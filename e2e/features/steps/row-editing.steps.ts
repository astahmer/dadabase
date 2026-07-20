import { createClient } from "@libsql/client";
import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Given, Then, When } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathsFile = path.join(__dirname, "../../.tmp/paths.json");

async function resetSampleDb() {
  const { sampleDbPath } = JSON.parse(readFileSync(pathsFile, "utf8")) as {
    sampleDbPath: string;
  };
  const client = createClient({ url: `file:${sampleDbPath}` });

  await client.execute("DELETE FROM posts");
  await client.execute("DELETE FROM memberships");
  await client.execute("DELETE FROM notes");
  await client.execute("DELETE FROM users");
  await client.execute("DELETE FROM no_pk_items");

  await client.execute(`
    INSERT INTO users (id, name, email, age, active) VALUES
      (1, 'Alice', 'alice@example.com', 30, 1),
      (2, 'Bob', 'bob@example.com', 25, 1),
      (3, 'Charlie', 'charlie@example.com', 35, 0)
  `);
  await client.execute(`
    INSERT INTO posts (id, user_id, title, body) VALUES
      (1, 1, 'Hello', 'First post'),
      (2, 2, 'World', 'Second post')
  `);
  await client.execute(`
    INSERT INTO memberships (org_id, user_id, role) VALUES
      (1, 1, 'admin'),
      (1, 2, 'member')
  `);
  await client.execute(`
    INSERT INTO notes (id, title, payload) VALUES
      (1, 'meta', '{"color":"blue","count":1}')
  `);
  await client.execute(`
    INSERT INTO no_pk_items (label, value) VALUES
      ('alpha', '1'),
      ('beta', '2')
  `);

  client.close();
}

Given(
  "I have a SQLite sample database connection named {string}",
  async ({ page }, connectionName: string) => {
    await resetSampleDb();
    await page.goto(`/connections/${connectionName}`);
    await expect(page).toHaveURL(new RegExp(`/connections/${connectionName}`));
    await expect(page.getByPlaceholder("Filter tables...")).toBeVisible({ timeout: 30_000 });
  },
);

Given("I open the {string} table", async ({ page }, tableName: string) => {
  const filter = page.getByPlaceholder("Filter tables...");
  await expect(filter).toBeVisible({ timeout: 20_000 });
  await filter.fill(tableName);
  const tableItem = page.locator("[data-tables-list]").getByText(tableName, { exact: true });
  await expect(tableItem).toBeVisible({ timeout: 15_000 });
  await tableItem.click();
  await expect(page.getByTestId("add-row-button")).toBeVisible({ timeout: 20_000 });
});

When("I click Add row", async ({ page }) => {
  await page.getByTestId("add-row-button").click();
  await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
});

When(
  "I fill the row editor field {string} with {string}",
  async ({ page }, fieldName: string, value: string) => {
    const field = page.getByTestId(`column-input-${fieldName}`);
    await expect(field).toBeVisible();

    const defaultBtn = field.getByRole("button", { name: "Default" });
    if (await defaultBtn.isVisible().catch(() => false)) {
      if ((await defaultBtn.getAttribute("class"))?.includes("bg-primary")) {
        await defaultBtn.click();
      }
    }

    const nullBtn = field.getByRole("button", { name: "NULL" });
    if (await nullBtn.isVisible().catch(() => false)) {
      if ((await nullBtn.getAttribute("class"))?.includes("bg-primary")) {
        await nullBtn.click();
      }
    }

    const input = field.locator("input, textarea").first();
    await input.fill(value);
  },
);

When(
  "I pick FK value {string} for field {string}",
  async ({ page }, fkValue: string, fieldName: string) => {
    const field = page.getByTestId(`column-input-${fieldName}`);
    await expect(field).toBeVisible();

    const input = field.getByTestId("fk-column-select");
    await input.click();
    await input.fill(fkValue);

    const option = page.getByRole("option", { name: fkValue }).first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();
  },
);

When("I save the row editor", async ({ page }) => {
  await page.getByTestId("row-editor-save").click();
  await expect(page.getByTestId("row-editor-sheet")).toBeHidden({ timeout: 15_000 });
});

When("I save the row editor expecting failure", async ({ page }) => {
  await page.getByTestId("row-editor-save").click();
  await expect(page.getByTestId("row-editor-error")).toBeVisible({ timeout: 15_000 });
});

When("I cancel the row editor", async ({ page }) => {
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("row-editor-sheet")).toBeHidden({ timeout: 10_000 });
});

When("I click Show SQL", async ({ page }) => {
  await page.getByRole("button", { name: "Show SQL" }).click();
  await expect(page.getByTestId("row-editor-sql-preview")).toBeVisible();
});

When(
  "I open the edit sheet for the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();

    const row = cell.locator("xpath=ancestor::tr[1]");
    const rowNumber = row.getByRole("button").first();
    await rowNumber.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit row" }).click();
    await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
  },
);

When(
  "I open the duplicate sheet for the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();

    const row = cell.locator("xpath=ancestor::tr[1]");
    const rowNumber = row.getByRole("button").first();
    await rowNumber.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate row" }).click();
    await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
  },
);

When(
  "I try to open the edit sheet for the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();

    const row = cell.locator("xpath=ancestor::tr[1]");
    const rowNumber = row.getByRole("button").first();
    await rowNumber.click({ button: "right" });
  },
);

When(
  "I double-click the cell in column {string} for the row with {string}",
  async ({ page }, columnName: string, cellValue: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();
    await cell.dblclick();
    await expect(page.getByTestId("inline-cell-editor")).toBeVisible();
  },
);

When("I type {string} into the inline editor and press Enter", async ({ page }, value: string) => {
  const editor = page.getByTestId("inline-cell-editor").locator("input");
  await editor.fill(value);
  await editor.press("Enter");
  await expect(page.getByTestId("inline-cell-editor")).toBeHidden({ timeout: 15_000 });
});

When(
  "I select the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();
    const row = cell.locator("xpath=ancestor::tr[1]");
    // First column is the row-number button that toggles selection
    await row.getByRole("button").first().click();
    await expect(page.getByText(/1 row selected/i)).toBeVisible({ timeout: 10_000 });
  },
);

When("I delete the selected rows from the bulk action bar", async ({ page }) => {
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete rows?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Delete rows?" })).toBeHidden({
    timeout: 15_000,
  });
});

When("I click Edit on the bulk action bar", async ({ page }) => {
  await page.getByTestId("bulk-edit-button").click();
  await expect(page.getByTestId("row-editor-sheet")).toBeVisible({ timeout: 10_000 });
});

When(
  "I open the edit sheet from the row actions menu for the row with {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    const cell = page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first();
    await expect(cell).toBeVisible();

    const row = cell.locator("xpath=ancestor::tr[1]");
    await row.getByTestId("row-actions-menu").click();
    await page.getByRole("menuitem", { name: "Edit row" }).click();
    await expect(page.getByTestId("row-editor-sheet")).toBeVisible();
  },
);

When("I switch the row editor to JSON mode", async ({ page }) => {
  const tabs = page.getByTestId("row-editor-view-mode");
  await expect(tabs).toBeVisible();
  await tabs.getByRole("tab", { name: "JSON" }).click();
  await expect(page.getByTestId("json-monaco-editor")).toBeVisible({ timeout: 15_000 });
});

When("I set the row JSON editor to contain {string}", async ({ page }, fragment: string) => {
  const editor = page.getByTestId("json-monaco-editor");
  await expect(editor).toBeVisible();

  const textarea = editor.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 15_000 });
  const current = await textarea.inputValue();
  const nameMatch = fragment.match(/"name"\s*:\s*"[^"]*"/);
  const patched = nameMatch
    ? current.replace(/"name"\s*:\s*"[^"]*"/, nameMatch[0])
    : current.includes(fragment)
      ? current
      : `${current.slice(0, -1)}${current.trim().endsWith("{") ? "" : ","}\n  ${fragment}\n}`;
  await textarea.fill(patched);
});

When("I set field {string} to NULL", async ({ page }, fieldName: string) => {
  const field = page.getByTestId(`column-input-${fieldName}`);
  await expect(field).toBeVisible();
  const nullBtn = field.getByRole("button", { name: "NULL" });
  await expect(nullBtn).toBeVisible();
  await nullBtn.click();
  await expect(field.locator("p").filter({ hasText: /^NULL$/ })).toBeVisible();
});

Then(
  "I should see cell value {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    await expect(
      page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }).first(),
    ).toBeVisible({ timeout: 15_000 });
  },
);

Then(
  "I should not see cell value {string} in column {string}",
  async ({ page }, cellValue: string, columnName: string) => {
    await expect(
      page.getByTestId(`data-cell-${columnName}`).filter({ hasText: cellValue }),
    ).toHaveCount(0);
  },
);

Then("I should see SQL preview containing {string}", async ({ page }, fragment: string) => {
  await expect(page.getByTestId("row-editor-sql-preview")).toContainText(fragment);
});

Then("I should see a row editor error containing {string}", async ({ page }, fragment: string) => {
  await expect(page.getByTestId("row-editor-error")).toContainText(fragment);
});

Then("the edit row action should be unavailable", async ({ page }) => {
  await expect(page.getByRole("menuitem", { name: "Edit row" })).toHaveCount(0);
});
