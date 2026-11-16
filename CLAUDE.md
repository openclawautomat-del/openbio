# Open Bio

Self-hosted link-in-bio + URL shortener + QR + analytics. Single Node process, small stack, MySQL on the same host (Hostinger shared hosting is the target).

## Stack

- **Next.js 15** (App Router, `output: "standalone"`), React 19, TypeScript (strict-ish, `tsc --noEmit`)
- **MySQL** via `mysql2` promise pool (default `connectionLimit: 5`); no ORM
- **No Tailwind.** Design system is hand-rolled CSS: `src/app/globals.css` (tokens + components), `src/app/bio.css` (public bio pages), `src/app/editor.css` (dashboard editor). Read these before touching UI.
- `lucide-react` icons (single set, stroke 1.75), `zod` validation, `bcryptjs`, `qrcode`, `nodemailer`
- Tests: `node --test` (`tests/*.test.ts`) — pure logic tests, no DB needed
- Migrations: plain SQL files in `migrations/`, runner in `scripts/migrate.mjs` and `src/lib/migrate.ts` (used by the installer)

## Commands

```bash
npm run dev            # next dev
npm run build          # next build + postbuild (standalone copy)
npm run start          # node server.js
npm run migrate        # apply pending migrations
npm run seed           # demo data (dev only)
npm run typecheck      # tsc --noEmit
npm test               # node --test tests/*.test.ts
```

## Folder map

- `src/app/` — App Router. Routes: `/` (home), `/[slug]` (public: bio page OR short link, shared namespace), `/out/[id]` (redirect by id), `/api/*`, `/dashboard/*` (authed), `/admin/*` (super_admin), `/auth` group (login/register/reset), `/install`, `/report`, `/docs`, `/terms`, `/privacy`. Route groups: `(app)` = dashboard+admin shell, `(auth)`.
- `src/app/actions/*.ts` — server actions (auth, app, admin, public, install, phase2)
- `src/lib/` — `db.ts` (pool/query/exec), `auth.ts` (sessions, roles, audit), `brand.ts` (settings-driven brand: name/url/host), `settings.ts` (key-value cache), `validation.ts` (slug/email/URL schemas, blocklist), `url-check.ts` (SSRF-safe URL checks), `analytics.ts` (clicks), `services/` (links, pages, users, public), `ratelimit.ts`, `crypto.ts`, `email/`
- `migrations/` — 001_core (users, links, pages, blocks, clicks, ...), 002_email, 003_phase2 (teams, groups, goals, contact_messages)
- `tests/` — node:test logic tests
- `scripts/` — migrate, seed, postbuild

## Domain model (current → new)

- **users**: one per account, `username` = bio-page handle, `role` user|super_admin, `status` active|suspended.
- **links**: `slug` (globally unique), `target_url`, password, schedule, enabled/moderated flags.
- **pages/blocks**: bio page per user (1:1), blocks are ordered content (links, headers, forms, ...).
- **Old**: user-owned `domains` table (user adds host, TXT verify). **Removed** — replaced by admin-managed domains (see PROGRESS.md).
- **New**: `domains` (admin-managed: hostname, status pending/active/disabled, is_default) + `slug_review` queue + reserved-slug seeds in `blocklist`/new table. Slugs + usernames share ONE namespace (links.slug UNIQUE, users.username UNIQUE — same values collide).

## Invariants that matter

- All public URLs render from **the current default domain** (settings `default_domain`), never a per-link host.
- Public content (`/[slug]`, `/out`) is served **only on the default domain**; every other host gets a plain 404 for those paths. Dashboard/admin/API/installer stay reachable on all active admin domains + APP_URL host.
- The default domain can never be deleted or disabled (lockout prevention). Exactly one default at all times.
- `TRUST_PROXY=true` is what makes `X-Forwarded-Host/Proto` mean anything.
