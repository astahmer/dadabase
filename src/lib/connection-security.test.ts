import { describe, expect, it } from "vitest";

import {
  applySslMode,
  decodeSshTunnelConfig,
  encodeSshTunnelConfig,
  guardReadOnlyMutation,
  isReadOnlyConnection,
  parseSslMode,
  stripDadabaseMarkerParams,
  withReadOnlyFlag,
} from "./connection-security.ts";

describe("applySslMode / parseSslMode", () => {
  it("sets the sslmode query param", () => {
    const url = applySslMode("postgres://user:pass@host:5432/db", "require");
    expect(url).toBe("postgres://user:pass@host:5432/db?sslmode=require");
  });

  it("overwrites an existing sslmode value", () => {
    const url = applySslMode("postgres://host/db?sslmode=disable", "verify-full");
    expect(new URL(url).searchParams.get("sslmode")).toBe("verify-full");
  });

  it("round-trips through parseSslMode", () => {
    const url = applySslMode("postgres://host/db", "verify-full");
    expect(parseSslMode(url)).toBe("verify-full");
  });

  it("returns null for missing or unrecognized sslmode", () => {
    expect(parseSslMode("postgres://host/db")).toBeNull();
    expect(parseSslMode("postgres://host/db?sslmode=bogus")).toBeNull();
  });

  it("returns the original string unchanged for unparsable URLs", () => {
    expect(applySslMode("not a url", "require")).toBe("not a url");
    expect(parseSslMode("not a url")).toBeNull();
  });
});

describe("encodeSshTunnelConfig / decodeSshTunnelConfig", () => {
  it("round-trips a full config", () => {
    const config = {
      host: "bastion.example.com",
      port: 22,
      user: "deploy",
      privateKeyPath: "~/.ssh/id_ed25519",
    };
    expect(decodeSshTunnelConfig(encodeSshTunnelConfig(config))).toEqual(config);
  });

  it("round-trips a config without an optional privateKeyPath", () => {
    const config = { host: "bastion.example.com", port: 22, user: "deploy" };
    expect(decodeSshTunnelConfig(encodeSshTunnelConfig(config))).toEqual(config);
  });

  it("returns null for invalid JSON", () => {
    expect(decodeSshTunnelConfig("not json")).toBeNull();
  });

  it("returns null when required fields are missing or mistyped", () => {
    expect(decodeSshTunnelConfig(JSON.stringify({ host: "h", port: "22", user: "u" }))).toBeNull();
    expect(decodeSshTunnelConfig(JSON.stringify({ host: "h", user: "u" }))).toBeNull();
    expect(decodeSshTunnelConfig(JSON.stringify({ port: 22, user: "u" }))).toBeNull();
    expect(decodeSshTunnelConfig("null")).toBeNull();
    expect(decodeSshTunnelConfig("42")).toBeNull();
  });

  it("returns null when privateKeyPath has the wrong type", () => {
    expect(
      decodeSshTunnelConfig(JSON.stringify({ host: "h", port: 22, user: "u", privateKeyPath: 1 })),
    ).toBeNull();
  });
});

describe("withReadOnlyFlag / isReadOnlyConnection", () => {
  it("sets the readonly marker", () => {
    const url = withReadOnlyFlag("postgres://host/db", true);
    expect(isReadOnlyConnection(url)).toBe(true);
  });

  it("clears the readonly marker", () => {
    const url = withReadOnlyFlag("postgres://host/db?dadabase_readonly=1", false);
    expect(isReadOnlyConnection(url)).toBe(false);
  });

  it("defaults to false when the marker is absent", () => {
    expect(isReadOnlyConnection("postgres://host/db")).toBe(false);
  });

  it("returns the original string unchanged for unparsable URLs", () => {
    expect(withReadOnlyFlag("not a url", true)).toBe("not a url");
    expect(isReadOnlyConnection("not a url")).toBe(false);
  });
});

describe("stripDadabaseMarkerParams", () => {
  it("removes the readonly marker before the URL reaches a real DB driver", () => {
    const url = withReadOnlyFlag("postgres://host/db", true);
    expect(stripDadabaseMarkerParams(url)).toBe("postgres://host/db");
  });

  it("leaves other query params untouched", () => {
    const url = withReadOnlyFlag("postgres://host/db?sslmode=require", true);
    const stripped = stripDadabaseMarkerParams(url);
    expect(new URL(stripped).searchParams.get("sslmode")).toBe("require");
    expect(new URL(stripped).searchParams.has("dadabase_readonly")).toBe(false);
  });

  it("does not touch URLs without any dadabase_ marker (avoids mangling relative file: paths)", () => {
    expect(stripDadabaseMarkerParams("file:test.db")).toBe("file:test.db");
    expect(stripDadabaseMarkerParams("file:./relative/path.db")).toBe("file:./relative/path.db");
  });

  it("strips the marker even from a file: URL with an absolute path", () => {
    const stripped = stripDadabaseMarkerParams("file:///tmp/db.sqlite?dadabase_readonly=1");
    expect(stripped).toBe("file:///tmp/db.sqlite");
  });

  it("returns the original string unchanged for unparsable URLs", () => {
    expect(stripDadabaseMarkerParams("not a url ?dadabase_readonly=1")).toBe(
      "not a url ?dadabase_readonly=1",
    );
  });
});

describe("guardReadOnlyMutation", () => {
  const readOnlyUrl = withReadOnlyFlag("postgres://host/db", true);

  it("allows mutations on a non-read-only connection", () => {
    expect(guardReadOnlyMutation("postgres://host/db")).toBeNull();
  });

  it("blocks mutations on a read-only connection", () => {
    expect(guardReadOnlyMutation(readOnlyUrl)).toMatch(/read-only/i);
  });

  it("allows SELECT-only SQL on a read-only connection", () => {
    expect(guardReadOnlyMutation(readOnlyUrl, { isSelect: true })).toBeNull();
  });

  it("still blocks non-SELECT SQL on a read-only connection", () => {
    expect(guardReadOnlyMutation(readOnlyUrl, { isSelect: false })).toMatch(/read-only/i);
  });
});
