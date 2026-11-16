# Progress — admin-managed domains work

Checklist for the "replace user-owned custom domains with admin-managed domains" task. Check as milestones land; commit after each.

## Milestones

- [x] M0 — Exploration, this file, `CLAUDE.md`
- [ ] M1 — `openbio-design` skill (`.claude/skills/openbio-design/SKILL.md`) from the existing design system
- [ ] M2 — Remove user-owned domain feature (dashboard page, actions, `/domain` route, middleware rewrite, docs) + backward-compatible migration `004_admin_domains.sql` (converts old user-domain schema to admin schema, seeds APP_URL host as default)
- [ ] M3 — Admin > Domains (add/edit/disable/delete, statuses pending/active/disabled, exactly one `is_default`, lockout seed of APP_URL host), `Check & activate` HTTPS probe with exact failure reason + admin override, `GET /api/health`, TRUST_PROXY-gated X-Forwarded-Host/Proto
- [ ] M4 — Single slug namespace (links + usernames), all URLs rendered from current default domain (copy-link, canonical, OG, sitemap, QR, emails, API)
- [ ] M5 — Host gating: public content only on default domain, 404 on any other host (incl. previous default); dashboard/admin/api/installer on all active admin domains + APP_URL; unknown host → 404 for everything. Middleware rework.
- [ ] M6 — Default-domain change flow (active-only, single transaction, confirm dialog, audit log, warning that old URLs/QRs die); disable/delete never touches links; default undeletable
- [ ] M7 — Slug normalization (NFKC, 3–32, a-z0-9-_) + reserved slugs (app routes + static paths + editable DB seed list) + test that fails on new top-level routes
- [ ] M8 — Anti-phishing: protected brands + sensitive words, lookalikes/repeated chars, review queue (slugs held inactive on Free until approved)
- [ ] M9 — Destination safety hardening (scheme, credentials, SSRF ranges, own-domain loops, shortener chaining, blocked domains, optional Safe Browsing) + periodic re-check
- [ ] M10 — Abuse handling: public rate-limited report endpoint, admin queue, one-click actions (disable link / suspend user / blocklist domain / edit lists), interstitial for disabled/reported links; slug-creation rate limits (per user + IP); generic errors
- [ ] M11 — Performance: LRU+TTL slug cache w/ invalidation, async batched click logging (flush timer + count + shutdown), DB indexes, pool=5 default, dynamic imports for heavy admin/charts, standalone output, caching headers
- [ ] M12 — Design pass on all touched pages (mobile-first: 44px targets, 16px inputs, dvh, safe-area, stacked cards, bottom sheets, truncation) per `openbio-design`
- [ ] M13 — Tests: domain lifecycle, default change, URL rendering, non-default 404, lockout, every reserved/phishing rule, review queue, URL safety, reserved-route test. Targeted per milestone; full suite + lint + typecheck at the end
- [ ] M14 — Playwright screenshots @ 360/390/768/1280 of: home, login/register, dashboard, link create, bio page, admin > Domains, report-link page. Fix, move on.
- [ ] M15 — README/docs/CHANGELOG (hPanel + SSL + Check & activate + set default; old-URL consequences; reserved slugs) + final summary of manual steps

## Decisions

- Old `domains` table (user_id, verify_token) is repurposed: `DROP` and recreate as admin-managed (`hostname`, `status`, `is_default`, `last_check_*`) — links/users never referenced it, so dropping is safe; migration keeps other phase-2 tables.
- `TRUST_PROXY` inverts default: headers are only read when explicitly `TRUST_PROXY=true` (task requirement).
- Reserved words seeded into a dedicated table at install; admin-editable.
- Review queue = `links.moderated` style: new field `links.pending_review` (0/1) — held inactive until an admin approves.
