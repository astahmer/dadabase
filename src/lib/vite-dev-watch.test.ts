import { describe, expect, it } from "vitest";

import { VITE_SERVER_WATCH_IGNORED } from "./vite-dev-watch.ts";

describe("VITE_SERVER_WATCH_IGNORED", () => {
  it("ignores project-local reference clones", () => {
    expect(VITE_SERVER_WATCH_IGNORED).toContain("**/.references/**");
  });

  it("ignores markdown and *.local files that used to force full reloads", () => {
    expect(VITE_SERVER_WATCH_IGNORED).toContain("**/*.md");
    expect(VITE_SERVER_WATCH_IGNORED).toContain("**/*.local");
  });

  it("ignores e2e artifacts", () => {
    expect(VITE_SERVER_WATCH_IGNORED.some((p) => p.includes("e2e"))).toBe(true);
  });
});
