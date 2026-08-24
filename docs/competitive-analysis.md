# Competitive analysis — dadabase vs database GUIs (2026-08)

Compared against: DBeaver, TablePlus, Beekeeper Studio, JetBrains DataGrip, DbGate,
pgAdmin, Outerbase Studio, Conar.app, data-peek, plus context from Supabase Studio /
Drizzle Studio / Prisma Studio (browse-only modern clients).

Star counts (GitHub, 2026-08): dbeaver 51.5k · beekeeper-studio 23.5k · supabase 108k ·
dbgate 7.2k · heidisql 6.2k · outerbase/studio 6k · mathesar 5.1k · pgadmin 3.8k ·
data-peek 1.7k · conar 1.4k · pgweb 9.5k · sqlchat 5.8k · chartbrew 4k.

## Feature matrix

| Feature | dadabase | DBeaver CE | TablePlus | Beekeeper | DataGrip | DbGate | pgAdmin | Outerbase | Conar | data-peek |
|---|---|---|---|---|---|---|---|---|---|---|
| Postgres / MySQL / SQLite / LibSQL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PG only | ✅ | PG/MySQL/MSSQL/CH | PG/MySQL/MSSQL/SQLite |
| MSSQL / Oracle | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | MSSQL | MSSQL |
| MongoDB / Redis | ❌ | ✅ | ⚠️ Mongo | ❌ | ⚠️ Mongo | ✅ both | ❌ | ❌ | Mongo soon | ❌ |
| Web-based (no Electron install) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ Electron | ❌ Tauri |
| Local-first / self-hosted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ cloud conn store | ✅ |
| SSH tunnel + SSL presets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read-only connection mode | ✅ | ⚠️ | ✅ | ✅ read-only data | ⚠️ console RO | ✅ | ⚠️ | ✅ | ❌ | ✅ RO tools |
| Grid browse + inline edit + pending edits review | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ browse-first | ✅ |
| Paste TSV/CSV as rows | ✅ | ✅ | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ |
| Import wizard (CSV/JSON → typed INSERT preview) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export CSV/TSV/INSERT | ✅ | ✅ +XLSX,MD,JSON… | ✅ +JSON,SQL dump | ✅ CSV/JSON/NDJSON/XLSX | ✅ many | ✅ many | ✅ CSV | ✅ | ❌ | ✅ CSV/JSON |
| Export JSON / XLSX / Markdown | ❌ | ✅ | ✅ JSON | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ⚠️ JSON |
| Monaco-class editor: completions + diagnostics | ✅ | ⚠️ own | ✅ | ⚠️ basic | ✅ best | ✅ Monaco | ⚠️ | ✅ Monaco | ✅ Monaco | ✅ Monaco |
| Per-statement Run/Explain view zones | ✅ unique-ish | ❌ | ❌ | ❌ | ⚠️ run under cursor | ❌ | ❌ | ❌ | ❌ | ❌ |
| Explain plan visualizer | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| Views / triggers / functions browser | ❌ parked | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Table DDL (CREATE stmt) viewer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ⚠️ |
| Create/alter/drop table UI | ✅ | ✅ | ✅ | ⚠️ limited | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| SQLite ALTER via table rebuild | ✅ rare | ✅ internal | ✅ | ✅ | ✅ | ✅ | n/a | ❌ | ❌ | ❌ |
| Index create/drop + FK editor UI | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Schema diff → migration SQL preview | ✅ | ✅ compare | ⚠️ | ❌ | ✅ best | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| ER diagram (FK graph, click-through) | ✅ | ✅ advanced | ✅ | ✅ | ✅ advanced | ✅ | ✅ | ✅ | ❌ | ✅ |
| Visual query builder | ❌ planned | ✅ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Saved queries + favorites + history | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ history |
| Command palette | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ⚠️ | ✅ |
| AI: NL→SQL over whole schema (BYOK) | ✅ | ⚠️ Pro | ⚠️ AI add-on | ❌ | ✅ Assistant | ❌ | ❌ | ✅ | ✅ core | ✅ multi-provider |
| AI chat thread (multi-turn) | ✅ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ✅ | ✅ | ✅ |
| AI-generated charts from results | ❌ planned | ❌ | ❌ | ❌ | ⚠️ charts | ❌ | ❌ | ✅ Baseboard | ❌ | ✅ flagship |
| Result charting / visualization | ❌ | ⚠️ EE only | ❌ | ❌ | ✅ | ❌ | ⚠️ graphs | ✅ dashboards | ❌ | ✅ |
| Dashboards (saved charts) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ |
| Sessions/activity monitor + kill query | ❌ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| One-click backup / restore (dump) | ❌ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users / grants / roles UI | ❌ | ✅ | ⚠️ PG roles | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ RLS view | ❌ | ❌ |
| Credentials encrypted / OS keychain | ❌ plaintext sqlite | ✅ | ✅ | ✅ | ✅ | ✅ master pwd | ✅ | ⚠️ cloud | ✅ encrypted | ✅ keychain |
| MCP server exposing connections to agents | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ approval-gated writes |
| Mock / fake data generation | ❌ | ✅ Pro | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Global search across all table data | ❌ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pivot / transpose results | ❌ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Geospatial (PostGIS) map preview | ❌ | ✅ | ❌ | ❌ | ✅ plugin | ❌ | ✅ | ❌ | ❌ | ❌ |
| Connection groups / colors / tags | ❌ | ✅ | ✅ | ✅ folders | ✅ | ✅ | ✅ server groups | ✅ | ✅ | ❌ |

## Where dadabase already wins

- **Web-based + local-first**, zero install — most OSS rivals are Electron; web rivals (Outerbase, Adminer) are thinner.
- **Safety posture**: read-only mode, destructive-query confirms, cascade-preview deletes, AI hard LIMIT 100 — nobody bundles all four.
- **Per-statement run/explain view zones** and **schema-diff → migration SQL preview** are rare even in paid tools.
- **SQLite ALTER via rebuild**, join-tables dialog, pending-edits review bar.

## Gaps worth building (ranked)

### Tier 1 — high impact, strong product fit

1. **Views / triggers / functions browser** (read + open definition). Every mature client has it; it's the #1 "why can't I see my view" complaint. Introspection work only, no new drivers. *(already parked in ideas.md — promote)*
2. **Charting / generative UI for query results.** data-peek's flagship, DataGrip's killer panel, Outerbase's whole pitch. You already plan vercel-labs/json-render — wire it to result sets first (bar/line/pie from any SELECT), saved charts later = mini-dashboards.
3. **MCP server exposing saved connections to agents.** data-peek proved the pattern (read-only free, writes gated by in-app approve/reject). Dadabase is a web app with pools already running — a `127.0.0.1` streamable-HTTP MCP endpoint reusing PoolCache is cheap and uniquely aligned with your agent-heavy workflow. Nobody else in the table does this except data-peek.
4. **Credential encryption (OS keychain or passphrase-derived)** for stored connection URLs. Currently plaintext in app.db — table stakes everywhere else.

### Tier 2 — solid table-stakes fillers

5. **Table DDL viewer** (`SHOW CREATE`-style from introspection) — trivial once #1 lands.
6. **Export JSON / NDJSON / Markdown / XLSX** alongside existing CSV/TSV/INSERT.
7. **Sessions/activity panel**: list running queries + cancel/kill (you already have cancellable queries client-side; needs `pg_stat_activity` / MySQL processlist).
8. **Connection groups/colors + per-connection theme accent** (TablePlus-style tab coloring prevents prod-vs-dev mistakes).
9. **Global fuzzy search across tables' data** (DBeaver-style DB-wide search, capped).
10. **Pivot / transpose result grid.**

### Tier 3 — deliberate scope decisions (probably skip / park)

11. More dialects (MSSQL, ClickHouse, MongoDB) — big driver surface, weakens the "lightweight local-first" story; only if users ask.
12. Backup/restore dump wrappers (pg_dump/mysqldump) — ops-flavored, Docker story gets messy.
13. Users/grants/roles admin — pgAdmin/Supabase territory.
14. Mock-data generation, anonymized exports — nice Pro-tier features, not core.
15. PostGIS map preview — niche.
16. Cloud-synced connections/team sharing — contradicts local-first positioning (Conar went that route).

## Suggested order if picking 3

`views/triggers/functions browser` → `result charting (json-render)` → `MCP endpoint`.
That sequence: closes the loukest maturity gap, adds a visible wow-feature, and creates a moat none of the popular clients have.
