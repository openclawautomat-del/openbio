# Contributing

Thanks for helping. Small, focused pull requests get reviewed fastest.

## Setup

```bash
npm install
cp .env.example .env     # fill in DB_* and AUTH_SECRET
npm run migrate
npm run seed             # optional demo data
npm run dev
```

Before you open a pull request:

```bash
npm run typecheck
npm test
npm run build
```

## Ground rules

- **No ORM.** Use `query`, `queryOne` and `exec` from `src/lib/db.ts` with `?` placeholders. Never build SQL from user input. Only integers already validated may be interpolated (for `LIMIT`).
- **Validate with zod** at every boundary: server actions, route handlers and API bodies.
- **Migrations are append-only.** Add a new numbered file in `/migrations`; never edit one that has shipped. Phase 2 tables go in files with `phase2` in the name.
- **Phase 2 must stay removable.** Phase 1 code must not import Phase 2 modules. Gate Phase 2 pages and actions with `phase2Enabled()`.
- **White-label.** Never hardcode a product name, domain or colour. Read them from `getBrand()`. The one exception is `src/lib/credit.ts`.
- **No shared credentials.** Anything that needs a key (Google, SMTP, S3) must work only when the owner configures it, and degrade quietly otherwise.
- **Server action files** (`"use server"`) may export only async functions.

## Design

- Icons: Lucide only.
- Fonts are self-hosted. Do not add a CDN.
- Meet WCAG AA contrast, keep visible focus rings, and respect `prefers-reduced-motion`.
- Every list needs a real empty state, and every form a clear error state.
- Write copy in plain, active English. Errors say what happened and how to fix it, without apologising.

## Translations

Add a JSON file under `src/lib/i18n` that mirrors `en`, then register it in `LANGUAGES`. Missing keys fall back to English.

## Commits and pull requests

Describe what changed and why. Link the issue. Add tests for logic that does not need a database.

## Reporting security problems

Do not open a public issue. See [SECURITY.md](SECURITY.md).
