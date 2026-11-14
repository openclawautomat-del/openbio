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
- Custom domains with DNS verification
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

Phase 2 features (domains, teams, contact blocks, goals, CSV) can be switched off with `FEATURE_PHASE2=false`. Phase 1 works without them.

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
| `TRUST_PROXY` | Read the client IP from proxy headers (keep `true` behind Hostinger or Cloudflare) |

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

### Custom domains

Users add a domain in **Dashboard > Domains**, create the shown DNS records (a CNAME or A record to your host, and a TXT record for verification), and click **Check DNS**. Your server must accept the domain: add each custom domain as an alias in hosting, or put Cloudflare or a wildcard setup in front. The custom-domain router reads `APP_URL` from the environment to tell your own host from others, so set it there and not only in admin settings.

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
| Short links show the wrong domain | `APP_URL` is wrong or still `localhost`. |
| Custom domain stays pending | The TXT record at `_verify.your-domain` must equal `domain-verify=TOKEN` exactly. DNS can take a while. |
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
