# Design system and UI guidelines

This is the canonical visual and component guidance for Rankedin Explorer. It describes the patterns already established in the product so new screens feel like part of the same tool.

## Sources of truth

- `src/styles/theme.css` owns the light and dark palette tokens, semantic colors and chart colors.
- `src/App.css` owns global typography, layout primitives, component styles and responsive rules.
- `src/components/` owns reusable display primitives and focused view components.
- `src/App.tsx` owns cross-workspace state and interaction orchestration; it should not become a second design-system file.

When a visual rule changes, update the token or shared class that expresses the rule. Do not add a one-off inline style or a page-specific offset to compensate for a misunderstood layout.

## Product character

The interface is a calm, editorial data utility: warm paper surfaces, clear dark ink, restrained blue links, coral emphasis and compact evidence panels. It should feel useful and inspectable rather than gamified or dashboard-heavy.

- Lead with the answer and supporting evidence, not decoration.
- Preserve generous whitespace around major sections and use dense layouts only for comparable data.
- Use color to communicate state, hierarchy or data encoding. Do not use color as the only explanation.
- Keep Rankedin as the source of truth visible through source links, honest labels and explicit missing-data states.

## Tokens and color

Use the variables in `src/styles/theme.css` for all new UI:

| Role | Token |
| --- | --- |
| Primary text | `--ink` |
| Secondary text | `--muted` |
| Page surface | `--paper` |
| Raised surface | `--card` |
| Subtle surface | `--paper-deep` |
| Borders | `--line` |
| Links and informational emphasis | `--blue`, `--blue-soft` |
| Positive state | `--sage`, `--sage-soft` |
| Attention, errors and primary emphasis | `--coral`, `--coral-soft` |
| Chart series | `--chart-4`, `--chart-5` plus the semantic colors above |

New semantic colors must have light and dark values in `src/styles/theme.css` before they are used. Hard-coded colors are appropriate only for an already-defined data visualization or a print-specific exception that cannot use a token.

## Typography

- The product uses Manrope with the system sans-serif stack as fallback.
- Use the existing heading hierarchy and letter spacing. Large headings are tight and editorial; data labels are small, uppercase and letter-spaced.
- Use `.eyebrow` for workspace status, `.section-kicker` for card labels and muted text for supporting metadata.
- Keep body copy readable and short. Do not make secondary text compete with the value it explains.
- Use tabular numerals when comparing dates, ratings, placements or scores.

## Layout and surfaces

- The main content uses the shared 1240px container and responsive page gutters.
- Use `field-card` for raised data sections and `history-card` when a padded, exploratory panel is more appropriate.
- Use CSS grid for repeated cards and columns, flexbox for alignment and toolbars, and overflow containers for genuinely wide tables.
- Prefer intrinsic sizing such as `minmax(0, 1fr)`, `min()`, `max()` and `clamp()` over fixed coordinates.
- Keep a consistent rhythm: cards use the shared border, radius and surface tokens; adjacent sections are separated by the established 14px spacing.
- Responsive behavior must preserve the information hierarchy. At the mobile breakpoints, columns stack, controls wrap and wide tables scroll instead of forcing the page wider.

## Reusable components

Use an existing primitive when the structure and meaning match. Current shared primitives include:

- `MetricCard` for a labeled value with supporting detail.
- `CardHeading` for a kicker, title, description and optional icon or tools inside a card.
- `RankedinLink` for source links that open a public Rankedin path in a new tab.
- `InfoTip` for concise explanations of unfamiliar metrics.
- `LoadingValue` for values that are not available yet.

Extract a component when the same semantic structure appears in at least two real places or when its interaction/accessibility behavior is easy to get wrong. Keep domain-specific composition in the owning view. Avoid generic components named `Box`, `Panel` or `Content` whose purpose cannot be understood from the props.

Keep shared component props semantic. A card heading should receive a title and description, not arbitrary spacing instructions; a source link should receive a Rankedin path, not duplicated target and security attributes.

## Data states and interaction

- Loading, error, empty, partial and unavailable states are normal product states. Render them explicitly.
- Missing data stays missing; never turn `null`, unavailable results or unpublished fields into zero or a confident claim.
- Use a button for an in-page action and an anchor for navigation or a Rankedin source link.
- Preserve visible `:focus-visible` treatment and keyboard access for every interactive control.
- Icon-only controls need an accessible label. Decorative icons should be hidden from assistive technology when adjacent text already explains them.
- Source links opened in a new tab must retain `rel="noreferrer"`.
- Destructive or irreversible actions are outside the current read-only product; do not introduce them casually.

## Verification for visual changes

For a UI change, run `npm run check` and inspect the affected view at desktop and at the narrow mobile breakpoint. Check light and dark themes when the change touches colors or surfaces. Pay particular attention to long names, empty states, loading states and tables with real overflow.

Keep implementation detail in code and tests. Update this document when a shared visual pattern or component contract changes; update `docs/architecture.md` when component ownership or data flow changes.
