/**
 * Shared visual-quality bar injected into planning and file generation so generated apps look
 * polished and modern by default — not a barebones, unstyled prototype. Kept concise because it is
 * added to every per-file generation call.
 */
export const DESIGN_GUIDE = `DESIGN BAR — the UI must look polished, modern and production-quality, never a barebones prototype:
- Cohesive design system: a small harmonious color palette defined as CSS variables / theme tokens, a consistent spacing scale, and a clear typographic hierarchy (distinct sizes & weights for headings vs body). Use a clean modern font stack (system-ui / Inter-style).
- Layout: generous whitespace, a comfortable max content width, balanced alignment and clear visual rhythm. Never leave elements unstyled, default-browser-looking, or cramped.
- Polish & depth: subtle shadows, rounded corners, considered borders, visible hover/focus states, and smooth subtle transitions. Ensure accessible contrast. A tasteful dark or light theme is fine — just make it intentional and consistent.
- Fully responsive from mobile to desktop (flex/grid, relative units, sensible breakpoints).
- Real, sensible content and copy — no "lorem ipsum", no empty placeholder boxes.
- If using plain HTML/CSS, ship a COMPLETE stylesheet with CSS custom properties for the palette; if using a framework, style every component consistently. Do not ship unstyled markup.`
