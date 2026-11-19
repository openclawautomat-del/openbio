# OpenBio

Self-hosted link-in-bio, URL shortener, QR codes and analytics. Runs on Hostinger shared hosting (Node 20+, MySQL).

## Stack
Next.js 15 (App Router, `output: standalone`), React 19, TypeScript strict, MySQL via `mysql2` (prepared statements,
pool of 5), zod, bcryptjs, nodemailer, qrcode. No ORM, no Tailwind: plain CSS in `src/app/*.css`.

## Folder map
- `src/app/(app)/dashboard|admin` signed-in UI; `(auth)` login/register/reset/verify; `[slug]` public short links and bio pages
- `src/app/actions/*.ts` server actions; `src/app/api/*` route handlers (`v1` is the key-authenticated API)
- `src/lib/*.ts` infra (db, settings, brand, auth, request, analytics); `src/lib/services/*` domain logic
- `src/components/*` UI; `migrations/*.sql` ordered, idempotent via `schema_migrations`; `tests/*.test.ts`
- Pure, DB-free rule modules (unit-testable with plain node): `url-check`, `slug-rules`, `url-safety`, `host-policy`, `lru`, `click-buffer`

## Commands
`npm run dev` | `npm run build` | `npm start` | `npm run migrate` | `npm test` (node --test, strip-types) | `npm run typecheck`

## Domain model (summary)
users (role super_admin|user, status active|suspended) 1-1 pages -> blocks. links (slug UNIQUE, owner, target_url).
Slugs and bio usernames share ONE namespace (checked in `slugTaken`). clicks (entity link|block|page), api_keys,
blocklist (domain|keyword), reports, audit_log, settings (key/value), mailboxes/email_*, link_groups, teams, goals,
contact_messages. New: `site_domains` (admin-managed, one `is_default`), `slug_lists` (reserved|brand|sensitive).

## Rules that must not regress
- Links/pages store only the slug. URLs are built at render time from the default domain (`getBrand().url`).
- Public content (`/[slug]`, `/out`, vcard, sitemap) is served only on the default domain; others get 404.
- Dashboard/admin/API/install work on every active domain and the APP_URL host. Unknown hosts: 404.
- Never trust X-Forwarded-* unless `TRUST_PROXY=true`. Errors for taken/blocked names are generic.
- Design: follow `.claude/skills/openbio-design/SKILL.md`.
