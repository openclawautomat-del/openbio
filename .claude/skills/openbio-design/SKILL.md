---
name: openbio-design
description: Open Bio design system — tokens, type, spacing, components, dark mode, and the "never do" list. Use for every page/component change in this repo.
---

# Open Bio design system

Refined utility, set like a printed ledger: **borders and rules carry structure, not shadows.** One accent color. The short link itself (`/slug` in mono) is the recurring typographic motif. All UI is plain HTML + the CSS classes in `src/app/globals.css` (shared), `bio.css` (public bio pages), `editor.css` (dashboard editor). No Tailwind, no shadcn.

## Tokens (`:root` in globals.css)

- Surfaces: `--bg #f2f3f0`, `--surface #fff`, `--sunken #e9ebe7`; ink `#15191c`, muted `#566069`; rules `--line #d6dad5`, `--line-strong`.
- One accent: `--accent` (default `#0E7C66`, overridden per-install via `--accent` inline style). Danger `#b3261e`, warn `#8a5a00`, ok `#17673a`. Focus ring is always `--focus` (a blue, distinct from accent).
- Dark mode: `[data-theme="dark"]` + `prefers-color-scheme` block — same token names, values flipped (`--bg #101312` etc.). **Never hard-code a color outside a token.** Use `var(--x)` everywhere; dark mode then works for free.
- Radius: `--radius 6px` for controls/panels; **0 on tables** (tables are ruled, not boxed).
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Don't invent sizes off-scale.
- Type scale: 12 / 13 / 14 / 16 / 20 / 28 / 44px. Display = Bricolage Grotesque (or Fraunces via admin font setting); text = Hanken Grotesk 15px/1.55; numbers/data = JetBrains Mono (`.num`, `.mono`, `.slug`).

## Components (use these classes, don't invent new ones)

- Buttons `.btn` (36px tall; `.btn-primary` = accent bg; `.btn-danger`; `.btn-sm` 30px; `.btn-icon` 32px square). Minimum touch height on mobile is 44px — on `<640px` bump primary actions to 44px via `.btn-lg` pattern in media queries.
- Forms: `.field` (label 13px/600 + `.input` 38px tall, 15px font — **inputs must stay ≥16px effective font or bump height so iOS never zooms**; text inputs here are 15px/38px which is fine; new controls follow it). `.input-prefix` for mono prefixes (the `/slug` motif).
- Feedback: `.notice` (+`.warn/.bad/.good`), `.badge` (+`.good/.warn/.bad`), `.err`/`.hint` under fields.
- Layout: `.shell` (232px sidebar + main), `.page-head` (h1 + sub, ruled bottom), `.cols` (2-col → 1 under 860px), `.panel` (ruled, 20px pad, 6px radius), `.tbl` in `.tbl-wrap` (horizontal scroll for wide tables), `.stats` (ruled stat strip, 2-col under 700px), `.subnav` (admin tabs).
- App state: `.empty` (48px top, 46ch max — always write specific copy: what's missing and the first step), `.skeleton` for loading.
- Icons: `lucide-react` only, 16px, `strokeWidth 1.75` (the `.icon` class). One icon family, never mix with emoji.

## Rules

1. **No AI tells:** no emoji icons, no purple/blue gradient glows, no rounded-card grids with identical soft shadows, no "Supercharge your..." centered hero, no three-column icon feature rows, no fake testimonials/stats, no lorem ipsum, no untouched shadcn look. Marketing copy must be concrete and short (the home page shows what "concrete" means).
2. **Structure via rules:** tables use `border-bottom` rows + `.tbl-wrap` scroll; sections separate with 1px rules (`border-top: 1px solid var(--ink)` for strong, `--line` for soft). Shadows only: drawer overlay, `.drop-before` line, ticket motif on home.
3. **Focus:** `:focus-visible` ring is `2px solid var(--focus), offset 2px` globally — never remove it; give custom controls the equivalent.
4. **Empty/loading/error are designed states**, not afterthoughts. `.empty` needs an h3 + one p of specific copy. Long lists scroll inside `.tbl-wrap`, never the page.
5. **Mobile-first:** 360px is the floor. `100dvh` not `vh`; `env(safe-area-inset-*)` padding on topbar/footers; nav collapses to a drawer (`NavToggle` + `.side.open`); dialogs/sheets: bottom sheet pattern on `<640px` (full-width, `border-radius: 12px 12px 0 0`, `max-height: 85dvh`, safe-area bottom inset); long slugs/URLs: `word-break: break-all` in `.slug`, `overflow-wrap: anywhere` in `.dest`.
6. **Microcopy:** plain, specific, no exclamation-mark marketing. Errors say what happened and the next step ("The TXT record at _verify.host does not match. Add it in hPanel, wait a minute, check again.").
7. **Motion:** `--ease` transitions, 150–200ms, background/border/transform only; `prefers-reduced-motion` already disables it.
8. **Data density:** dashboards are dense and ruled (`.tbl`, `.stats`, `.bars`); public bio pages follow `bio.css` (card-based, theme-driven). Don't make admin tables into card grids and don't add drop shadows to dashboards.
