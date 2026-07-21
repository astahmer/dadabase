import { Client } from "ssh2";

import type { SshTunnelConfig } from "#src/lib/connection-security.ts";

export type OpenSshTunnelResult = {
  /** Localhost port that forwards to the remote DB. */
  localPort: number;
  /** Close the SSH connection and free the local port. */
  close: () => void;
};

/**
 * Opens an SSH local forward to `destinationHost:destinationPort` via the bastion
 * described by `config`. Returns a local ephemeral port listeners can connect to.
 *
 * Auth: private key (`privateKeyPath`) and/or password. At least one is required.
 */
export async function openSshLocalForward(input: {
  config: SshTunnelConfig;
  destinationHost: string;
  destinationPort: number;
}): Promise<OpenSshTunnelResult> {
  const { config, destinationHost, destinationPort } = input;
  if (!config.privateKeyPath && !config.password) {
    throw new Error("SSH tunnel requires a private key path or password");
  }

  const fs = await import("node:fs/promises");
  const net = await import("node:net");

  const connectOpts: {
    host: string;
    port: number;
    username: string;
    privateKey?: Buffer;
    password?: string;
  } = {
    host: config.host,
    port: config.port,
    username: config.user,
  };
  if (config.privateKeyPath) {
    connectOpts.privateKey = await fs.readFile(config.privateKeyPath);
  }
  if (config.password) {
    connectOpts.password = config.password;
  }

  const client = new Client();

  await new Promise<void>((resolve, reject) => {
    client
      .on("ready", () => resolve())
      .on("error", reject)
      .connect(connectOpts);
  });

  const server = net.createServer((socket) => {
    client.forwardOut(
      socket.remoteAddress ?? "127.0.0.1",
      socket.remotePort ?? 0,
      destinationHost,
      destinationPort,
      (err, stream) => {
        if (err) {
          socket.destroy(err);
          return;
        }
        socket.pipe(stream).pipe(socket);
      },
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    client.end();
    throw new Error("Failed to bind local SSH forward port");
  }

  return {
    localPort: address.port,
    close: () => {
      server.close();
      client.end();
    },
  };
}
