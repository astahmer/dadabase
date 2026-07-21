import { describe, expect, it, vi } from "vitest";

import { withSshTunnelConfig } from "#src/lib/connection-security.ts";

import { DatabaseDialect } from "../dialect.ts";
import { resolveDriverUrlWithOptionalSsh } from "./pool-cache.ts";

describe("resolveDriverUrlWithOptionalSsh", () => {
  it("strips dadabase markers and leaves host unchanged when no SSH config", async () => {
    const { driverUrl, closeTunnel } = await resolveDriverUrlWithOptionalSsh({
      url: "postgres://db.example:5432/app?dadabase_readonly=1",
      dialect: DatabaseDialect.Postgres,
    });
    expect(driverUrl).toBe("postgres://db.example:5432/app");
    expect(closeTunnel).toBeUndefined();
  });

  it("opens a local forward and rewrites host/port when SSH is configured", async () => {
    const close = vi.fn();
    const openTunnel = vi.fn(async () => ({ localPort: 39999, close }));
    const url = withSshTunnelConfig("postgres://db.internal:5432/app", {
      host: "bastion.example",
      port: 22,
      user: "jump",
      privateKeyPath: "/tmp/id_ed25519",
    });

    const { driverUrl, closeTunnel } = await resolveDriverUrlWithOptionalSsh({
      url,
      dialect: DatabaseDialect.Postgres,
      openTunnel,
    });

    expect(openTunnel).toHaveBeenCalledWith({
      config: {
        host: "bastion.example",
        port: 22,
        user: "jump",
        privateKeyPath: "/tmp/id_ed25519",
      },
      destinationHost: "db.internal",
      destinationPort: 5432,
    });
    expect(new URL(driverUrl).hostname).toBe("127.0.0.1");
    expect(new URL(driverUrl).port).toBe("39999");
    expect(closeTunnel).toBe(close);
  });

  it("forwards password auth config to the tunnel opener", async () => {
    const openTunnel = vi.fn(async () => ({ localPort: 40000, close: vi.fn() }));
    const url = withSshTunnelConfig("mysql://db.internal:3306/app", {
      host: "bastion.example",
      port: 22,
      user: "jump",
      password: "s3cret",
    });

    await resolveDriverUrlWithOptionalSsh({
      url,
      dialect: DatabaseDialect.MySQL,
      openTunnel,
    });

    expect(openTunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ password: "s3cret" }),
        destinationPort: 3306,
      }),
    );
  });

  it("does not statically import ssh-tunnel (keeps ssh2 out of Vite graph)", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./pool-cache.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toMatch(/from ["']#src\/server\/ssh-tunnel/);
    expect(source).toMatch(/await import\(["']#src\/server\/ssh-tunnel/);
  });
});
