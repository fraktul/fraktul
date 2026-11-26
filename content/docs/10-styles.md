---
title: Styles and themes
summary: Two looks for the map, flat and y2k, each in light and dark.
section: Guides
---
The map comes in two styles, and each style has a light and a dark theme. Readers choose in the map's top bar; the
choice is remembered in their browser.

## Styles

**Flat** is the default: a quiet, modern interface with flat neutral surfaces, one blue accent and the Inter typeface.
It suits a map that people read every day.

**Y2K** is opt-in: a liquid-chrome bar, wide Michroma titles, brushed-metal diagram boxes and glass controls. fraktul.dev
wears it. Pick **Y2K** from the **Style** menu in the map to try it.

Both styles share one set of design tokens, so diagrams, panels and tours look right in either. The diagram colours
for `:::model`, `:::code`, `:::human`, `:::data` and `:::ext` come from the tokens too, which is why your own
`classDef` lines are ignored.

## Light and dark

The map follows the system's light or dark setting until the reader presses the theme button (☀ / ☾). From then on it
stays on their choice in that browser. Diagrams redraw in the new colours straight away. The 3D space is always dark, in
every style and theme, so its light streams read.

## Readability rules

Both styles follow the same rules, and every text colour meets WCAG AA contrast in both themes:

- Body text sits on a flat surface, never on a gradient.
- Gradients are for bars, buttons, the logo and the tour strip.
- Components read only tokens, so a new style is a new set of token values.

## Seeing every token

The [design page](/design) on fraktul.dev shows both styles in light and dark: colours, type, controls and diagram
boxes. The tokens themselves are in fraktul's `src/pages/css/tokens.css`.
