# Provenance — nexus-app-starter

License intent: MIT once publication is decided (repo PRIVATE-first, decision D11; no LICENSE file until then). Every file carries an origin tag; `derived` files may not ship to clients or publish until replaced by `rebuilt`.

Origin tags: `ours` (from scratch) · `rebuilt` (clean-room from written specs/ideas, spec cited) · `derived` (traces to third-party source).

| Path | Origin | Notes |
|---|---|---|
| server/*, src/app/*, src/lib/*, scripts/*, journeys/*, boards/*, docs/*, Dockerfile, configs | ours | authored fresh for this starter |
| src/ui/** | vendored from `achammah/nexus-ui` (see its own PROVENANCE.md: ours/rebuilt; zero derived) — synced by `scripts/sync-ui.mjs`, version in `src/ui/.ui-version` |
| dependencies (package.json) | MIT/ISC libraries consumed as packages (React, Vite, Radix, TanStack, dnd-kit, lucide, playwright) — no vendored third-party source files |

Carry-scan record (2026-07-19): the prior fork workstream's own-authored adapter package was reviewed and deliberately NOT carried — this starter's mock backend serves a generic record contract, so all server/UI code is fresh; record-system interaction DESIGN (record-page anatomy, kanban model, table conventions) was carried as written specs only (ideas, not expression). Zero `derived` files at this commit.
