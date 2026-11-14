# Security

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on the repository, or email the maintainers at the address in the repository profile. Include the version, steps to reproduce and the impact.

You can expect an acknowledgement within a few days and a fix or a plan within 30 days. We credit reporters who want credit.

## Supported versions

Only the latest release gets security fixes.

## What the app does

- Passwords: bcrypt, cost 12. Sessions are random tokens; only their hash is stored. Cookies are httpOnly, SameSite and Secure over HTTPS.
- Input: zod validation on every action and API route. SQL uses prepared statements only.
- CSRF: server actions check the origin, and state-changing routes require it.
- XSS: React escaping, no raw HTML from users, and a strict Content-Security-Policy and other security headers.
- Redirects: `next` parameters accept same-site paths only. Short-link targets accept public http(s) URLs only. Private, loopback, link-local and numeric hosts are refused (SSRF), as are embedded credentials.
- Abuse: database-backed rate limits on login, registration, reset, contact forms, API keys and exports. Admin blocklist and report flow.
- Privacy: visitor IPs are never stored in the clear. Analytics use salted daily hashes.
- Secrets: SMTP and S3 passwords are encrypted with AES-256-GCM using a key derived from `AUTH_SECRET`. API keys are stored hashed.
- CSV: exports neutralize spreadsheet formula injection.

## What you must do as the owner

- Set a long random `AUTH_SECRET` and keep it out of version control.
- Serve over HTTPS and set `APP_URL` to the `https://` address.
- Turn on email verification and configure SPF, DKIM and DMARC for production.
- Keep Node.js and dependencies updated, and back up the database.
