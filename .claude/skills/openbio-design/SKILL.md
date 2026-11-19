---
name: openbio-design
description: Design system and UI rules for OpenBio. Use whenever you add or change any page, component, form, table, dialog, empty state or CSS in this repo, including admin pages, even for small tweaks. Keeps new UI consistent with the existing ledger-style look and prevents generic AI-looking output.
---

# OpenBio design system

Direction: refined utility, set like a printed ledger. Structure comes from rules (1px borders) and type, not shadows.
The short link itself (`host/slug`, class `.slug`) is the recurring motif. One accent. Everything lives in
`src/app/globals.css`; extend it, do not fork it. No Tailwind, no UI kit.

## Tokens (CSS variables, light and dark)
- Surfaces: `--bg` page, `--surface` raised, `--sunken` wells and table hover. Text: `--ink`, `--muted`.
- Lines: `--line` (hairline), `--line-strong` (inputs, table head), `--ink` for the heavy top rule of tables and stats.
- Accent: `--accent` (admin-configurable, default #0e7c66), `--accent-text`, `--accent-soft`. Use it for the primary
  button, active nav, the slug's slash and meters. Nothing else gets color except status.
- Status: `--ok/--ok-soft`, `--warn/--warn-soft`, `--danger/--danger-soft`. Focus ring: `--focus`.
- Dark mode: tokens are redefined under `[data-theme="dark"]` and `prefers-color-scheme`. Never hardcode a color in a
  component; if you need a new one, add a token to both themes.

## Type
- Display: Bricolage Grotesque (`--font-display`), or Fraunces when the admin picks serif. Text: Hanken Grotesk.
  Mono: JetBrains Mono for slugs, hostnames, tokens, IDs. Loaded with `next/font` in `layout.tsx`; do not add fonts.
- Scale 12 / 13 / 14 / 16 / 20 / 28 / 44. Body 15px. Sentence case everywhere. Numbers use `.num` (tabular).
- Line length under 70ch (`.prose`, `.page-head p`). Headings: `h1` 28, `h2` 20, `h3` 16, tight tracking.

## Spacing and shape
- Scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Radius 6px on controls and panels, 0 on tables, 3px on badges.
- Layout primitives: `.row`, `.stack`, `.stack-sm`, `.cols` (2-up, collapses at 860px), `.grid2`, `.panel`, `.toolbar`.
- Page skeleton: `.page-head` (h1 + one sentence) then content. Admin pages sit under `AdminTabs`.

## Components (reuse, do not reinvent)
- Buttons: `.btn`, `.btn-primary` (one per view), `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-icon`.
- Forms: `ActionForm`, `Field`, `ActionButton`, `ConfirmButton`, `CopyButton` from `components/client.tsx`.
  Errors are inline under the field (`.err`), form-level feedback is `.notice` (`good|warn|bad`).
- Status: `.badge` with `good|warn|bad`. Always pair color with a word (Active, Pending, Disabled).
- Tables: `.tbl-wrap` + `.tbl`. On narrow screens either scroll inside `.tbl-wrap` or use `.stack-rows` (cards).
- Icons: lucide-react only, class `icon`, 16px, stroke 1.75, always next to a text label or with `aria-label`.
- Empty state: `.empty` with an h3 that says what is missing and a sentence that says what to do next.
- Loading: `.skeleton` blocks or `loading.tsx`. Error: say what failed and how to fix it. No apologies.

## Microcopy
Name things as the user sees them ("Short name", "Default domain"), not as the system stores them. Buttons say what
happens ("Check & activate", "Make default"). The same verb through the whole flow. Taken or blocked names always
read "This name is not available." Show the exact reason for admin-only failures (e.g. a TLS error).

## Responsive rules (360px up)
- Mobile first. No horizontal page scroll: long slugs and URLs use `overflow-wrap:anywhere` or ellipsis.
- Touch targets at least 44px high under 860px (buttons, nav links, inputs, tabs). Inputs 16px font minimum.
- Use `100dvh`, never `100vh`. Respect `env(safe-area-inset-*)` on fixed bars and bottom sheets.
- Dialogs: centered panel on desktop, bottom sheet (`.sheet`) under 640px with the primary action reachable by thumb.
- Sidebar becomes the off-canvas drawer under 860px; sub-nav (`.subnav`) scrolls horizontally inside itself.

## Accessibility
Visible `:focus-visible` ring on everything. Labels on every input. `aria-current="page"` on active nav.
Respect `prefers-reduced-motion`. Contrast AA in both themes. Dialogs trap focus and close on Escape.

## Never do
- Emoji as icons. Purple or blue gradients, glows, blurred blobs, glassmorphism.
- Grids of identical rounded cards with the same soft shadow. Shadows are only for the open drawer and sheets.
- Centered "Supercharge your..." heroes, three-column icon feature grids, fake testimonials, invented stats, lorem ipsum.
- All-caps tracked eyebrow labels, numbered 01/02/03 markers on non-sequences, single-word accent in headlines.
- A new accent color, a second icon set, a new font, or `vh` units. Untouched default component-library looks.
- Hover or entrance animation on every card. Motion only answers an action (open, confirm) and is short.
- Hardcoding the product name, domain or colors: read them from `getBrand()`.

## Checklist before finishing a page
1. Looks right in light and dark. 2. Works at 360, 390, 768, 1280 with no sideways scroll. 3. Empty, loading and
error states exist and give a next step. 4. Keyboard path works and focus is visible. 5. Copy is specific.
