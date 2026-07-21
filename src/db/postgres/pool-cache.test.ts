import { describe, expect, it, vi } from "vitest";

import { withSshTunnelConfig } from "#src/lib/connection-security.ts";

import { resolveDriverUrlWithOptionalSsh } from "./pool-cache.ts";

describe("resolveDriverUrlWithOptionalSsh", () => {
  it("strips dadabase markers and leaves host unchanged when no SSH config", async () => {
    const { driverUrl, closeTunnel } = await resolveDriverUrlWithOptionalSsh({
      url: "postgres://db.example:5432/app?dadabase_readonly=1",
      dialect: "postgres",
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
      dialect: "postgres",
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
});
