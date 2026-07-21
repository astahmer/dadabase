import { describe, expect, it } from "vitest";

import {
  applySslMode,
  decodeSshTunnelConfig,
  encodeSshTunnelConfig,
  isReadOnlyConnection,
  parseSslMode,
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
