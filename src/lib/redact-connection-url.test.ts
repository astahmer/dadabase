import { describe, expect, it } from "vitest";

import { withSshTunnelConfig } from "./connection-security.ts";
import { redactConnectionUrl } from "./redact-connection-url.ts";

describe("redactConnectionUrl", () => {
  it("masks the URL userinfo password", () => {
    expect(redactConnectionUrl("postgres://user:secret@host:5432/db")).toBe(
      "postgres://user:*****@host:5432/db",
    );
  });

  it("masks credential query parameters", () => {
    const redacted = redactConnectionUrl(
      "libsql://example.turso.io?authToken=private-token&secret=another-secret",
    );
    const parsed = new URL(redacted);
    expect(parsed.searchParams.get("authToken")).toBe("*****");
    expect(parsed.searchParams.get("secret")).toBe("*****");
    expect(redacted).not.toContain("private-token");
    expect(redacted).not.toContain("another-secret");
  });

  it("masks password inside dadabase_ssh blob", () => {
    const url = withSshTunnelConfig("postgres://db.example:5432/app", {
      host: "bastion",
      port: 22,
      user: "jump",
      password: "tunnel-secret",
      privateKeyPath: "/tmp/key",
    });
    const redacted = redactConnectionUrl(url);
    expect(redacted).not.toContain("tunnel-secret");
    expect(redacted).toContain("dadabase_ssh=");
    // Decoded blob should still expose host for debugging
    const encoded = new URL(redacted).searchParams.get("dadabase_ssh")!;
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    expect(JSON.parse(json)).toMatchObject({
      host: "bastion",
      user: "jump",
      password: "*****",
      privateKeyPath: "/tmp/key",
    });
  });

  it("replaces a malformed dadabase_ssh blob", () => {
    const redacted = redactConnectionUrl("postgres://host/db?dadabase_ssh=not-valid-base64!!!");
    expect(new URL(redacted).searchParams.get("dadabase_ssh")).toBe("*****");
  });

  it("returns the original string when URL parsing fails", () => {
    expect(redactConnectionUrl("not a url")).toBe("not a url");
  });
});
