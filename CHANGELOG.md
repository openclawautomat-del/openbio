# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- **Breaking:** user-owned custom domains are gone. Domains are now managed by the Super Admin in Admin > Domains. Run `npm run migrate`: migration 004 is additive and copies old user domains in as *pending* admin domains, 005 drops the old `domains` table. Remove `APP_SERVER_IP` and `APP_CNAME_TARGET` from your environment if you set them.
- Links and bio pages are served only on the default domain. Every other host returns 404 for them. Dashboard, admin, API and installer stay reachable on every active domain and the `APP_URL` host. Unknown hosts return 404.
- Every public URL is built from the current default domain at render time. Nothing about a domain is stored on links or pages.
- `X-Forwarded-Host` and `X-Forwarded-Proto` are trusted only when `TRUST_PROXY=true`.
- Slugs and usernames: lowercase ASCII, 3 to 32 characters. Existing names are not changed, but renames and new names follow the new rules.

### Added
- Admin > Domains: add, edit, disable, delete, Check & activate (HTTPS check of `/api/health`, exact failure reason, explicit override), change default with confirmation and audit entry. The `APP_URL` host is seeded as the default.
- `GET /api/health`.
- Reserved route and static names, editable reserved, brand and sensitive-word lists, look-alike detection, review queue (Admin > Names and safety).
- Destination safety: raw IPs, private ranges, credentials, shortener chaining and self-loops rejected; optional Google Safe Browsing; six-hourly re-check.
- Public report page and `POST /api/report`, one-click admin actions, warning page for reported or disabled links, rate limits on name creation.
- Performance: short-TTL cache for slug lookups, batched asynchronous click logging flushed on shutdown, new indexes, lazy-loaded mail library.

### Removed
- User domain UI, API routes, DNS and TXT verification.

## [1.0.0] - 2026-11-14

First release.

### Added
- Web installer at `/install` that checks the database, runs migrations, creates the Super Admin and locks itself
- Accounts: register, login, logout, password reset, optional email verification, optional Google sign-in
- Link-in-bio pages with themes, social icons, unlimited links and drag-and-drop ordering
- URL shortener with custom slugs, expiry, start dates, password protection and enable/disable
- QR codes in PNG and SVG with colour and logo options
- Analytics: clicks, uniques, country, device, browser, referrer, UTM campaigns, hashed IPs, bot filtering
- REST API with keys, rate limits and docs at `/docs`
- Admin panel: dashboard, users, moderation with bulk actions, blocklist, reports, settings, audit log
- Email: SMTP per mailbox type, database queue with retry, daily limits, logs, test button
- White-label branding from environment and admin settings
- Phase 2 (switchable with `FEATURE_PHASE2`): custom domains, vCard, contact form blocks, product and service blocks, embeds, scheduled links, link groups, team workspaces, CSV import and export, conversion goals
- English and Spanish translations
