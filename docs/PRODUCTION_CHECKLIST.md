# Production checklist

Run top to bottom before the first real deploy. Items are ordered by blast radius.

## Data + demo state
- [ ] Replace or empty the demo seed: delete `sampleRows`/`seedCount` from `starter.config.json` (the "Demo data" badge in the sidebar disappears when no seeded rows exist).
- [ ] Swap `server/store.mjs` for the real data twin (warehouse/DB client) — the `/api` surface and UI don't change.
- [ ] Confirm every object's `sampleRows` ids never leak into real data flows (stable ids like `co_1` are journey fixtures).

## Auth + secrets
- [ ] Set `APP_SECRET` (32+ random chars) — sessions are HMAC-signed with it; rotating it logs everyone out.
- [ ] Set `AUTH_USERS` or wire a real identity provider in `server/auth.mjs`. Never ship the example credentials.
- [ ] Secrets live in the host's secret store, not in the client bundle: anything referenced in `src/` ships to the browser. Server-only values stay in `server/env.mjs`'s schema.
- [ ] Cookie hardening: the session cookie is `httpOnly` + `sameSite=lax`; serve over HTTPS so `secure` applies (front with a proxy/CDN if the host doesn't terminate TLS).

## Surface hygiene
- [ ] Delete unused example surfaces (Kit demo page, unused objects) — `src/app/pages.tsx` + `starter.config.json`.
- [ ] Review upload limits (`server/server.mjs` file cap, 5 MB default) against real usage.
- [ ] The `/enrich` endpoint is a labeled MOCK — either wire the real primitive (see RECIPES) or remove the `primitive` config so the sparkle disappears.
- [ ] Structured logs: replace ad-hoc `console.log` calls you added during build; the server's own boot lines are fine.

## Verification
- [ ] `npm run precheck` green locally; CI green on the branch.
- [ ] `npm run journeys` against the PRODUCTION config (`CONFIG_PATH=...`) — journeys must pass on what actually ships, not just the demo config.
- [ ] Open every nav item once in the deployed app (the cheapest smoke test there is).

## Legal/meta (public-facing apps)
- [ ] Terms/Privacy placeholders if the app faces external users; cookie-consent only if you add tracking (none ships by default).
- [ ] `robots.txt`/`sitemap.xml` only matter for public marketing surfaces — this starter ships an app shell, not a marketing site.
