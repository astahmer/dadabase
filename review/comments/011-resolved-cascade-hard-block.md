# RESOLVED — Cascade delete hard-blocked on any RESTRICT/NO ACTION edge

| Field       | Value                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Status      | **resolved**                                                                       |
| Severity    | high (at introduction)                                                             |
| Introduced  | `xvmpmoqq` / cascade dialog wiring in `mnzqpkpo`                                   |
| Resolved by | `wnslvszo` — `fix(cascade): treat RESTRICT FK edges as advisory, not a hard block` |

## Original issue

Dialog set `disabled={preview.blocked \|\| isPending}`, so any parent table with a child FK using default NO ACTION (e.g. sample `posts → users`) could never delete rows from the UI, even when no child rows existed.

## Resolution

Delete stays enabled; copy clarifies structural advisory. Remaining gap tracked in [005](./005-cascade-preview-structural-only.md) (row counts).
