# OpenBio

A self-hosted link-in-bio page, URL shortener, QR code maker and click analytics tool, in one small Node.js app with a MySQL database. It runs on cheap shared Node hosting (built and tested around Hostinger's Node.js Web App), uses local disk for uploads, and needs no paid service.

It is white-label. The name, tagline, colours, logo and fonts all come from your settings, so you can run it as your own product.

MIT licensed.

## What you get

**Link-in-bio**
- Public page at `/{username}` with avatar, bio, social icons and unlimited links
- Drag-and-drop ordering, scheduled links, link groups
- Several hand-built themes plus custom colours
- Contact form, product and service blocks, embeds, vCard download

**Short links**
- Custom slugs, redirects, start and expiry dates, password protection, enable and disable
- QR codes as PNG or SVG, with colour and logo options

**Analytics**
- Clicks, unique visitors, country, device, browser, referrer, UTM campaigns, time series
- Visitor IPs are hashed, bots are filtered, conversion goals, CSV export

**Accounts and teams**
- Register, log in, reset password, optional email verification, optional Google sign-in
- Team workspaces with editor and viewer roles
- Admin-managed domains with one default, an HTTPS check before activation and a safe switch of the default
- Reserved names, look-alike and phishing protection, an admin review queue and a public report form
- CSV import and export of links

**REST API**
- API keys, rate limits, docs at `/docs` (also in [docs/API.md](docs/API.md))

**Admin panel** (`/admin`, Super Admin only)
- Dashboard with health checks, users, link and page moderation with bulk actions
- Blocklist, abuse reports, audit log
- Settings for branding, general, email, integrations, API and legal text

**Email**
- Your own SMTP via Nodemailer, one mailbox per email type with fallback to a default
- Database queue with retry and backoff, daily limits with a warning at 80%
- Logs, usage meters and a test button

Phase 2 features (teams, contact blocks, goals, CSV) can be switched off with `FEATURE_PHASE2=false`. Phase 1 works without them.

## Screenshots

Add your own after the first run, for example in `docs/screenshots/`:

| Page | File |
| --- | --- |
| Public bio page | `docs/screenshots/bio.png` |
| Dashboard | `docs/screenshots/dashboard.png` |
| Analytics | `docs/screenshots/analytics.png` |
| Admin | `docs/screenshots/admin.png` |

## Requirements

- Node.js 20 or newer
- MySQL 8 or MariaDB 10.5+ with a utf8mb4 database (localhost is fine)

## Run it locally

```bash
npm install
cp .env.example .env
```

Edit `.env`: set the `DB_*` values and a long random `AUTH_SECRET`.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```bash
npm run dev
```

Open <http://localhost:3000/install>. The installer checks the database, runs the migrations and creates your Super Admin account, then locks itself. You can also run migrations from the terminal with `npm run migrate`.

For demo content in development, run `npm run seed`. It creates a `demo` user with a random password printed to the terminal. It refuses to run when `NODE_ENV=production`.

Run the tests with `npm test` and the type check with `npm run typecheck`.

## Configuration

Everything is in `.env`. After install, an admin can override the branding values in **Admin > Settings**. The order is: admin settings, then environment, then built-in defaults.

| Variable | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection |
| `AUTH_SECRET` | 32+ random characters. Signs tokens and encrypts stored SMTP passwords. Changing it invalidates both. |
| `APP_NAME` | Product name shown everywhere |
| `APP_URL` | Public URL, no trailing slash. Used in emails, QR codes, short links |
| `APP_TAGLINE` | One-line description |
| `APP_SUPPORT_EMAIL` | Contact address shown on legal and error pages |
| `APP_PRIMARY_COLOR` | Brand colour as `#RRGGBB` |
| `FEATURE_PHASE2` | `false` or `0` turns off the Phase 2 features |
| `UPLOAD_DIR` | Where uploads are stored. Must survive deploys. |
| `TRUST_PROXY` | `true` makes the app trust `X-Forwarded-Host` and `X-Forwarded-Proto` (and the client IP headers). Keep `true` behind Hostinger or Cloudflare. Any other value ignores those headers. |
| `GOOGLE_SAFE_BROWSING_KEY` | Optional. Adds a Google Safe Browsing check on destinations. Everything works without it. |
| `DB_POOL` | MySQL connections per process. Default 5, which suits shared hosting. |
| `CLICK_BATCH`, `CLICK_FLUSH_MS` | Analytics batching: flush after this many clicks (default 50) or this many ms (default 5000). |

Google sign-in, SMTP and S3 storage work only when you configure them in **Admin > Settings**. No credentials ship with the code.

Email verification is off by default. Turn it on in **Admin > Settings > General** before going public; it is recommended for production.

## Deploy on Hostinger (Node.js Web App)

1. In hPanel, create a **MySQL database** and user. Note the name, user and password. The host is `localhost`.
2. Run `npm install && npm run build` locally, or let Hostinger build it. Upload the project (or connect the Git repository) as a **Node.js Web App**.
3. Set the build command to `npm install && npm run build` and the start file to `server.js`. Use Node 20 or newer.
4. Add the environment variables from the table above in the app's environment settings. `APP_URL` must be your real `https://` domain.
5. Start the app and open `https://your-domain/install`. Run through the installer.
6. Point **UPLOAD_DIR** at a folder outside the build output (for example `/home/USER/openbio-uploads`) so uploads survive redeploys.
7. In **Admin**, check the health table. Every row should be green.

Server notes: the app runs one Node process and a 60-second timer that sends queued email. It keeps no other background workers.

### Domains

Only the Super Admin manages domains, in **Admin > Domains**. Users never add or choose one.

To add a domain:

1. In Hostinger hPanel, create the subdomain (for example `go.example.com`) and point it at this Node.js app.
2. Install SSL for that subdomain in hPanel. The app never issues or renews certificates.
3. In **Admin > Domains**, add `go.example.com`. It starts as **pending**.
4. Press **Check & activate**. The app requests `https://go.example.com/api/health` and needs a valid certificate and a reply from this app. If it fails, the exact reason is shown (DNS not resolving, expired or self-signed certificate, wrong subdomain target, redirect). **Activate anyway** is an explicit override that is recorded in the audit log.
5. To serve public content from it, press **Make default**.

The host of `APP_URL` is added as an active domain and as the default automatically, on fresh installs and on upgrades, so nobody can be locked out. Set `TRUST_PROXY=true` behind Hostinger so the real host is read from `X-Forwarded-Host`.

What each kind of domain serves:

| Route | Default domain | Other active domains and the `APP_URL` host | Unknown hosts |
| --- | --- | --- | --- |
| Short links `/<slug>`, bio pages, `/out/*`, vCard | Served | 404 | 404 |
| Dashboard, admin, API, installer, login | Served | Served | 404 |
| `/api/health` | Served | Served | Served |

There are no aliases and no redirects. Links and bio pages store only the slug or username, so no data changes when the default changes: every URL (copy link, QR targets, canonical and Open Graph tags, sitemap, emails, API responses) is built from the current default domain when it is rendered.

**Changing the default** (Super Admin only, active domains only) is one database transaction with an audit log entry. After it, **old URLs and printed QR codes on the previous domain stop working** and return 404. Disabling or deleting a domain never deletes links. The default domain cannot be disabled or deleted. Google sign-in uses the default domain for its redirect URI, so add the new address there when you switch.

### Short names and bio usernames

Short link slugs and bio usernames share one namespace and the same rules:

- NFKC-normalised, lowercase ASCII only: `a-z`, `0-9`, hyphen, underscore. 3 to 32 characters, no leading, trailing or doubled hyphens.
- Reserved: every top-level route of the app, static paths (`_next`, `uploads`, `robots.txt`, `.well-known`, ...), and an editable list (`www`, `mail`, `support`, `verify`, ...) plus your app name. A test fails when a new top-level route is added without being reserved (`src/lib/slug-rules.ts`).
- Protected brands: a brand on its own, or a brand with a sensitive word (`paypal-login`), is refused, including look-alikes (`paypa1`, `rnicrosoft`, `vvhatsapp`) and repeated letters (`gooogle`). A name that only contains a brand (`paypal-fan`) is accepted but waits in **Admin > Names and safety** and stays inactive for non-admin users until approved.
- All three lists are editable there. Refused and taken names show the same message: "This name is not available."
- Creating or renaming names is rate limited per user and per IP.

Destinations must be public `http` or `https` URLs. Credentials in the URL, raw IP addresses, localhost and private ranges, links back to this site's own domains, other URL shorteners and the blocked-domains list are rejected. With `GOOGLE_SAFE_BROWSING_KEY` set, destinations are also checked at creation and every six hours afterwards; flagged links are switched off and appear in the admin queue.

Reports: `/report` (and `POST /api/report`) are public and rate limited. Reports appear in **Admin > Reports** with one-click actions: disable the link, suspend the user, block the destination domain. A link with an open report shows a warning page before anyone is sent on.

## Email setup

Add a mailbox in **Admin > Email**. You can set a default mailbox and give each type (account, security, notifications, reports) its own. Types without a mailbox fall back to the default. With no mailbox, email is switched off and the app keeps working: verification and reset links are not sent, so leave verification off until SMTP works.

To get your mail into inboxes, set up these DNS records for your sending domain:

- **SPF**: a TXT record such as `v=spf1 include:_spf.your-mail-host.com ~all`. Use the include your mail provider gives you.
- **DKIM**: enable DKIM in your mail provider and publish the TXT record it shows.
- **DMARC**: start with `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:you@your-domain`, then tighten to `quarantine` once reports look clean.

Use the **Send test email** button before turning on verification. Daily limits are per mailbox. The page warns you at 80% of the limit.

## Updating

1. Back up the database and the uploads folder (see below).
2. Replace the code with the new release and run `npm install && npm run build`.
3. Run `npm run migrate`. Migrations are plain SQL files in `/migrations` and each runs once.
4. Restart the app.

Check [CHANGELOG.md](CHANGELOG.md) for anything that needs manual steps.

## Backup and restore

```bash
mysqldump --single-transaction -u USER -p DB_NAME > openbio-backup.sql
tar czf openbio-uploads.tgz /path/to/UPLOAD_DIR
```

Restore with `mysql -u USER -p DB_NAME < openbio-backup.sql` and unpack the uploads archive. Keep a copy of `AUTH_SECRET`: without it, saved SMTP passwords cannot be decrypted.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `/install` says it cannot reach the database | Wrong `DB_*` values. On shared hosting the host is usually `localhost`. |
| Installer shows "already installed" | It locked itself. Log in at `/login`. To reinstall, restore a fresh empty database. |
| Everyone is logged out after a deploy | `AUTH_SECRET` changed. |
| Emails never arrive | Check **Admin > Email**: queue and failed counts, then use the test button. Check SPF and DKIM. |
| Uploaded images vanish after redeploy | `UPLOAD_DIR` is inside the build folder. Move it outside. |
| Wrong IPs or countries in analytics | `TRUST_PROXY` is off, or your proxy does not send a country header. Country is blank without one. |
| Short links show the wrong domain | The default domain in **Admin > Domains** is not the one you expect. If no domain exists yet, `APP_URL` is wrong or still `localhost`. |
| A domain stays pending | Read the reason under it in **Admin > Domains**. Most often the subdomain does not point at this app yet, or SSL is not installed for it. |
| Everything returns 404 on a new domain | Public content is served only on the default domain. Dashboard and admin work on every active domain. |
| Wrong host is detected behind the proxy | Set `TRUST_PROXY=true`. |
| Build runs out of memory | Build locally and upload the result, or raise the Node memory limit with `NODE_OPTIONS=--max-old-space-size=2048`. |

## Security

See [SECURITY.md](SECURITY.md). In short: zod validation on every input, CSRF checks on forms, prepared SQL only, httpOnly cookies, bcrypt password hashing, database-backed rate limits, security headers, safe-redirect checks, SSRF protection on target URLs and a blocklist.

## Project layout

```
migrations/   plain SQL, applied in order by scripts/migrate.mjs and the installer
scripts/      migrate, seed, postbuild
src/app/      routes, pages, server actions, REST API
src/lib/      db, auth, email, analytics, services
tests/        unit tests (node:test)
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
