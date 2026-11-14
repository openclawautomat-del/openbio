# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

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
