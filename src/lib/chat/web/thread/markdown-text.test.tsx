// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownText } from "./markdown-text.tsx";

/**
 * Audit M1/M2/M3: fenced code blocks get syntax highlighting (rehype-highlight,
 * already a repo dep), a language label, per-fence copy buttons, and collapse
 * for tall blocks.
 */

const clipboardWrite = vi.fn<(text: string) => Promise<void>>(async () => {});

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWrite },
    configurable: true,
  });
});

afterEach(() => {
  clipboardWrite.mockClear();
  cleanup();
});

describe("MarkdownText code rendering", () => {
  it("applies highlight.js classes to fenced SQL (M1)", () => {
    const { container } = render(
      <MarkdownText text={"```sql\nSELECT count(*) FROM users;\n```"} />,
    );
    const highlighted = container.querySelector(".hljs-keyword");
    expect(highlighted).not.toBeNull();
    expect(container.querySelector("code.hljs")).not.toBeNull();
  });

  it("shows the language label on the fence header (M1)", () => {
    render(<MarkdownText text={"```sql\nSELECT 1;\n```"} />);
    expect(screen.getByTestId("code-language").textContent).toBe("SQL");
  });

  it("labels unknown languages with their raw id", () => {
    render(<MarkdownText text={"```brainfuck\n+\n```"} />);
    expect(screen.getByTestId("code-language").textContent).toBe("BRAINFUCK");
  });

  it("copies fence contents via the copy button (M2)", async () => {
    const sql = "SELECT id FROM orders WHERE total > 10;";
    render(<MarkdownText text={"```sql\n" + sql + "\n```"} />);
    fireEvent.click(screen.getByTestId("code-copy"));
    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith(sql);
    });
    await waitFor(() => {
      expect(screen.getByTestId("code-copy").textContent).toContain("Copied");
    });
  });

  it("leaves inline code unhighlighted and unlabeled", () => {
    const { container } = render(<MarkdownText text="Run `SELECT 1` first." />);
    expect(container.querySelector("[data-testid='chat-code-block']")).toBeNull();
    expect(container.querySelector(".hljs")).toBeNull();
  });

  it("collapses tall fences behind an expand toggle and expands on click (M3)", () => {
    const lines = Array.from({ length: 40 }, (_, index) => `SELECT ${index};`).join("\n");
    const { container } = render(<MarkdownText text={"```sql\n" + lines + "\n```"} />);

    const expand = screen.getByTestId("code-expand");
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(expand.textContent).toContain("Expand");

    fireEvent.click(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(expand.textContent).toContain("Collapse");
    // All 40 rendered lines are present in the DOM either way.
    expect(container.querySelectorAll("code.hljs > span")).not.toBeNull();
  });

  it("does not render an expand toggle for short fences", () => {
    render(<MarkdownText text={"```sql\nSELECT 1;\n```"} />);
    expect(screen.queryByTestId("code-expand")).toBeNull();
  });
});
