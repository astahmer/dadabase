import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";

import { buildConnectionUrl, isValidConnectionTarget } from "./connection-form-url.ts";

const baseInput = {
  filePath: "",
  libsqlAuthToken: "",
  connectionUrl: "",
  readOnly: true,
  sslMode: null,
  sshHost: "",
  sshPort: 22,
  sshUser: "",
  sshPrivateKeyPath: "",
  sshPassword: "",
};

describe("connection form URL", () => {
  it("preserves safe mode for SQLite paths", () => {
    const url = buildConnectionUrl({
      ...baseInput,
      connectionType: DatabaseDialect.SQLite,
      filePath: "/tmp/example.db",
    });

    expect(url).toBe("file:///tmp/example.db?dadabase_readonly=1");
    expect(isReadOnlyConnection(url)).toBe(true);
  });

  it("validates URL protocols by selected connection type", () => {
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.Postgres,
        filePath: "",
        connectionUrl: "postgres://user:pass@example.com/app",
      }),
    ).toBe(true);
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.MySQL,
        filePath: "",
        connectionUrl: "postgres://user:pass@example.com/app",
      }),
    ).toBe(false);
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.LibSQL,
        filePath: "",
        connectionUrl: "not a URL",
      }),
    ).toBe(false);
  });

  it("validates mssql URLs require the mssql scheme, host and user", () => {
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.Mssql,
        filePath: "",
        connectionUrl: "mssql://sa:secret@db.example.com:1433/AppDb",
      }),
    ).toBe(true);
    // wrong scheme rejected
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.Mssql,
        filePath: "",
        connectionUrl: "postgres://sa:secret@db.example.com/AppDb",
      }),
    ).toBe(false);
    // SQL-auth user is mandatory
    expect(
      isValidConnectionTarget({
        connectionType: DatabaseDialect.Mssql,
        filePath: "",
        connectionUrl: "mssql://db.example.com:1433/AppDb",
      }),
    ).toBe(false);
  });

  it("builds mssql URLs with readonly flag and sslmode applied", () => {
    const url = buildConnectionUrl({
      ...baseInput,
      connectionType: DatabaseDialect.Mssql,
      connectionUrl: "mssql://sa:secret@db.example.com/AppDb",
      readOnly: false,
      sslMode: "require" as const,
    });

    expect(url).toContain("mssql://sa:secret@db.example.com/AppDb");
    // readOnly=false removes the marker entirely (absence means read-write)
    expect(url).not.toContain("dadabase_readonly");
    expect(url).toContain("sslmode=require");
  });
});
