import { describe, expect, it } from "vitest";

import { parseMssqlUrl } from "./mssql-client.ts";

describe("parseMssqlUrl", () => {
  it("parses full URL with all parts", () => {
    const parts = parseMssqlUrl("mssql://sa:secret@db.example.com:1434/AppDb");
    expect(parts).toEqual({
      server: "db.example.com",
      port: 1434,
      database: "AppDb",
      username: "sa",
      password: "secret",
      encrypt: true,
      trustServerCertificate: false,
    });
  });

  it("defaults port to 1433 and database to empty", () => {
    const parts = parseMssqlUrl("mssql://sa:pw@localhost");
    expect(parts.port).toBe(1433);
    expect(parts.database).toBe("");
  });

  it("sslmode disable turns encryption off", () => {
    expect(parseMssqlUrl("mssql://sa:pw@h/db?sslmode=disable").encrypt).toBe(false);
  });

  it("sslmode require enables encryption + trusts the server certificate", () => {
    const parts = parseMssqlUrl("mssql://sa:pw@h/db?sslmode=require");
    expect(parts.encrypt).toBe(true);
    expect(parts.trustServerCertificate).toBe(true);
  });

  it("sslmode verify-full encrypts without trusting the certificate", () => {
    const parts = parseMssqlUrl("mssql://sa:pw@h/db?sslmode=verify-full");
    expect(parts.encrypt).toBe(true);
    expect(parts.trustServerCertificate).toBe(false);
  });

  it("explicit encrypt/trustServerCertificate params win over sslmode", () => {
    const parts = parseMssqlUrl(
      "mssql://sa:pw@h/db?sslmode=require&trustServerCertificate=false",
    );
    expect(parts.trustServerCertificate).toBe(false);
  });

  it("strips dadabase marker params before parsing", () => {
    const url = "mssql://sa:pw@h/db?dadabase_ssh=abc&dadabase_readonly=1";
    const parts = parseMssqlUrl(url);
    // URL parsing must not choke on marker params; they are ignored.
    expect(parts.server).toBe("h");
  });

  it("rejects non-mssql schemes loudly", () => {
    expect(() => parseMssqlUrl("postgres://u:p@h/db")).toThrow(/mssql:\/\/ scheme/);
    expect(() => parseMssqlUrl("not a url")).toThrow();
  });
});
