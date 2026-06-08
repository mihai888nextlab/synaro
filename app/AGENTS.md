# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Synaro Frontend Design Philosophy

This file defines the visual and UX philosophy for Synaro. Any frontend change must follow these rules unless the user explicitly requests an exception.

## Platform Context

- This project uses Next.js Pages Router + TypeScript + Tailwind CSS v4.
- Main component path is `app/src/components/ui`.
- Shared styles live in `app/src/styles/globals.css`.
- Alias is `@/* -> app/src/*`.

## Core Product Aesthetic

Synaro uses a premium dark B2B SaaS style:

- **Background-first dark theme:** black/zinc surfaces with subtle gradients and glows.
- **Low-noise visual system:** borders, contrast, spacing, and hierarchy do the heavy lifting.
- **Sharp readability:** concise headings, clear paragraph rhythm, high contrast on critical actions.
- **Motion is supporting, never distracting:** smooth, minimal transitions; avoid heavy animation overload.
- **Professional confidence:** UI copy should be direct, operational, and enterprise-friendly.

## Non-Negotiable Consistency Rules

1. **Keep design consistent across all pages and components**
  New screens must feel like part of the same product.
2. **Responsive quality is mandatory**
  For every frontend/UI change, verify:
  - mobile (`<640`)
  - tablet (`640-1023`)
  - desktop (`>=1024`)  
   If any breakpoint is broken or visually inconsistent, fix before finishing.
3. **Light + dark mode support is mandatory**
  Any new UI you build must look correct in **both** themes:
  - colors/surfaces/borders must adapt (no hard-coded `bg-black text-white` for dashboard UI)
  - hover/focus/active states must remain readable in both themes
  - prefer design tokens (`bg-background`, `bg-card`, `border-border`, `text-muted-foreground`)
  The theme is controlled in `/settings/preferences` and persisted per user/browser.
4. **Auth flow parity**
  Keep button styles, input styles, and text tone/structure consistent across:
  - login
  - signup
  - any future auth pages
5. **Do not introduce random visual styles**
  Reuse established classes, spacing scales, and interaction patterns from existing components.

## Layout System

- Use centered content containers and consistent width constraints:
  - primary page sections: `max-w-6xl` or `max-w-7xl`
  - auth/content forms: `max-w-md`
- Use section wrappers with:
  - `relative overflow-hidden`
  - optional `PageBackgroundPattern` layers
  - foreground content with `relative z-10`
- Vertical rhythm should be intentionally compact and consistent between sections.

Example:

```tsx
<section className="relative mx-auto max-w-6xl overflow-hidden px-4 sm:px-6 lg:pb-24">
  <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
  <div className="relative z-10 rounded-2xl border border-white/15 bg-zinc-950 p-8 md:p-12">
    {/* section content */}
  </div>
</section>
```

## Color, Surface, and Border Tokens

Prefer these patterns (already used across app):

- Prefer token-based surfaces so light/dark mode works:
  - page root: `bg-background text-foreground`
  - elevated surfaces: `bg-card` / `bg-card/80`
  - subtle outlines: `border-border/70`
  - muted content: `text-muted-foreground` / `text-muted-foreground/70`
  - subtle fills: `bg-muted`

Avoid introducing bright custom colors for core UI chrome unless it is accent-only.

## Light Theme Palette (Required)

Synaro light mode uses a strict 5-color palette:

- `#ffffff` (pure white): **cards / popovers / highest-elevation surfaces**
- `#fcfbfa` (paper): **page background**
- `#f8f7f5` (soft): **muted surfaces** (subtle rows, secondary panels)
- `#f5f4f0` (warm): **accent surface** (hovered / highlighted surface backgrounds)
- `#f1f0eb` (line): **borders / inputs**

Mapping rule of thumb:

- Background-first: page uses `bg-background` (paper) and content sits on `bg-card` (white).
- Use `bg-muted` for low-contrast containers; use `bg-accent` for interactive hover states.
- Borders should be calm: `border-border` (line color), not gray/black.

## Theme Transition (Required)

When switching themes, the UI must transition **smoothly and globally** so components change together.
Use a short color transition (~300–450ms) and respect reduced-motion preferences.

## Typography and Copy Rules

- Headings: concise, high signal, strong hierarchy (`text-2xl` -> `text-5xl` depending on context).
- Body copy: operational, plain-language, no marketing fluff overload.
- Keep sentence structure and tone parallel across similar pages.

Auth example consistency:

```tsx
description="Sign in to your Synaro workspace and continue managing your cloud infrastructure."
description="Create your Synaro workspace and start managing your cloud infrastructure."
```

## Buttons and Inputs

### Buttons

- Primary button pattern:
  - `rounded-full bg-white ... text-black hover:bg-zinc-200`
- Secondary button pattern:
  - `rounded-full border border-white/20 ... text-white hover:bg-white/10`
- Keep radius, weight, and paddings consistent by context.

### Square / Icon Buttons (Squircle Rule)

Any “square” icon button (header icons, toolbar actions, compact controls) must use Synaro’s
**squircle** treatment, matching the sidebar brand tile:

- shape: `rounded-xl`
- surface: `bg-card`
- outline: `border border-border/70`
- hover: `hover:bg-muted`

Example:

```tsx
<button className="h-9 w-9 rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground" />
```

### Inputs

- Inputs should use shared wrappers (glass/dark surfaces).
- Floating labels are allowed for auth forms, but keep existing style unchanged otherwise.
- Use consistent focus treatment and placeholder behavior.

Auth input example:

```tsx
<div className="auth-floating-wrapper">
  <input
    placeholder=" "
    className="auth-floating-input w-full rounded-2xl bg-transparent p-4 text-sm text-white"
  />
  <label className="auth-floating-label text-sm font-medium text-zinc-400">
    Email Address
  </label>
</div>
```

## Navigation and Footer Patterns

### Header

- Sticky, blurred dark top bar.
- Compact premium nav spacing.
- Dropdowns should overlay content (not push layout).
- Desktop and mobile behavior should feel part of one system.

### Footer

- Full footer content, not just copyright.
- Must include:
  - brand block
  - social links
  - resources/company columns
  - bottom legal line
- Match dark, subtle-border aesthetic of rest of app.

## Animation and Motion

- Favor subtle transitions over dramatic movement.
- On auth pages, avoid slow entry animations unless explicitly requested.
- Keep animation timing short and purposeful.

## Component Reuse Policy

Before creating new UI primitives, check existing components:

- `SiteHeader`
- `MinimalFooter`
- `PageBackgroundPattern`
- auth component(s)
- card primitives in `components/ui`

Prefer composing existing blocks over introducing new divergent patterns.

## Implementation Checklist (Must Pass)

For every frontend change:

1. **Visual consistency check**
  - matches existing color/surface/border system
  - typography and copy tone align with nearby sections/pages
2. **Component consistency check**
  - button/input styles follow existing patterns
  - auth pages remain consistent with each other
3. **Responsive check**
  - mobile, tablet, desktop all reviewed
  - no overlap, clipping, awkward spacing, or hierarchy breaks
4. **Interaction check**
  - hover/focus/active states are visible and coherent
  - dropdowns/modals do not break layout flow unintentionally
5. **Quality gate**
  - run lint
  - fix introduced issues before finishing

