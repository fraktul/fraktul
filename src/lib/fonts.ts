// The map's fonts ship with fraktul, like Mermaid and three.js: copied beside the page (vendor/fonts/) at build time,
// so a map loads nothing from a font service and still looks right offline. Latin subsets only; other scripts fall
// back to the system font.
import { html, raw, type SafeHtml } from "@bascik/bascik/html";

export type Font = { family: string; weight: string; pkg: string; file: string };

export const FONTS: Font[] = [
  { family: "Inter", weight: "100 900", pkg: "@fontsource-variable/inter", file: "inter-latin-wght-normal.woff2" },
  { family: "Manrope", weight: "200 800", pkg: "@fontsource-variable/manrope", file: "manrope-latin-wght-normal.woff2" },
  { family: "JetBrains Mono", weight: "100 800", pkg: "@fontsource-variable/jetbrains-mono", file: "jetbrains-mono-latin-wght-normal.woff2" },
  { family: "Michroma", weight: "400", pkg: "@fontsource/michroma", file: "michroma-latin-400-normal.woff2" },
  { family: "Syncopate", weight: "700", pkg: "@fontsource/syncopate", file: "syncopate-latin-700-normal.woff2" },
];

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

/**
 * The @font-face rules, and a preload for each family in `preload` (the ones a page shows first).
 * `prefix` is where the page finds the files: "vendor/fonts/" beside a map, "/vendor/fonts/" on a site with folders.
 */
export function fontTags(prefix: string, preload: string[] = []): SafeHtml {
  // Built only from the constants above and the two fixed prefixes, so it is safe to write as it is.
  const css = FONTS.map((f) => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url("${prefix}${f.file}") format("woff2");unicode-range:${LATIN}}`).join("");
  return html`${FONTS.filter((f) => preload.includes(f.family)).map((f) => html`<link rel="preload" href="${prefix + f.file}" as="font" type="font/woff2" crossorigin />`)}${raw(`<style>${css}</style>`)}`;
}
