# Progress: admin-managed domains

Branch: `admin-domains`. Each milestone is one commit. Environment note: no `node_modules` and no network for installs
in the build sandbox, so pure-TS tests run (`npm test`), full Next build/typecheck/Playwright need a machine with `npm ci`.

- [ ] M0  PROGRESS.md, CLAUDE.md, `.claude/skills/openbio-design/SKILL.md`
- [x] M1  Pure core: slug rules, phishing check, URL safety, host policy, LRU cache, click buffer (+ tests)
- [x] M2  Migrations 004 (additive + seed) and 005 (drop legacy user domains); remove user-domain feature
- [x] M3  Domain service, /api/health, Admin > Domains (add/edit/disable/delete, Check & activate, override, change default)
- [x] M4  Host gate (public content only on default domain, 404 elsewhere), URLs built from default domain
- [x] M5  Reserved slugs + phishing + review queue wired into create/rename/import/register; Admin > Slugs & safety
- [x] M6  Destination safety (SSRF, shorteners, loops, blocklist, optional Safe Browsing, periodic re-check)
- [x] M7  Abuse handling: Report page + endpoint, admin one-click actions, interstitial, rate limits
- [x] M8  Performance: LRU slug cache, batched click logging, indexes, dynamic imports, cache headers
- [x] M9 (CSS only; screenshots not possible, see notes)  Responsive/design pass (360/390/768/1280) on key pages
- [x] M10 Docs (README, CHANGELOG, docs/), pure-module tests (37 pass)

## Not verified here (needs `npm ci` on a machine with network)
The build sandbox has no network, so `next build`, `npm run typecheck`, `npm run lint`, DB-backed code paths and the Playwright screenshots
(360/390/768/1280) were NOT run. Only the pure modules were type-checked with tsc and tested (`npm test`: 37 pass).
