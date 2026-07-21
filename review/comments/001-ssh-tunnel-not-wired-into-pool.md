# SSH tunnel config is stored but never opened for pools

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | high |
| Introduced | `mxwzlspw` (URL helpers), `vqsvlzvm` (form + `openSshLocalForward`) |
| Relevant files | `src/lib/connection-security.ts`, `src/server/ssh-tunnel.ts`, `src/db/postgres/pool-cache.ts`, `src/components/pages/connection.form.tsx` |

## Summary

SSH bastion settings are encoded onto the connection URL (`dadabase_ssh`) and a low-level `openSshLocalForward` helper exists, but `PoolCache.getOrCreate` never reads that config or opens a local forward. Saving an SSH-enabled connection therefore stores dead metadata: the driver still dials the remote host/port directly.

`ideas.md` already notes this as “thin,” but the competitor checkbox for SSH is marked done, which overstates readiness.

## Suggested fix

In `getOrCreate` (or a wrapper used by remote connection setup):

1. `parseSshTunnelFromUrl(url)`
2. If present, `openSshLocalForward` to the URL host/port
3. Build the driver URL against `127.0.0.1:<localPort>`
4. Tie tunnel lifetime to the pool entry / layer scope (close on eviction)

Add an integration test that mocks `ssh2` or uses a local SSH daemon.
