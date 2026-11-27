// fraktul.dev head tags: every page's title, description, canonical URL, social card and structured data, in one
// place. The site-head component calls seoTags() with the page it is being built for (BASCIK_PAGE_PATH).
// Absolute URLs need the site URL (BASCIK_SITE_URL, set by the production build); a preview build leaves them out.
import { html, json, type SafeHtml } from "@bascik/bascik/html";
import { loadDocs } from "./docs.ts";

export const SITE_NAME = "fraktul";
export const TAGLINE = "Maps of software you can dive into";
const OG_ALT = "fraktul: a system diagram where one box opens into a smaller diagram, which opens into source code";

export type PageMeta = { path: string; title: string; description: string; kind: "home" | "page" | "doc" | "none"; section?: string };

const PAGES: PageMeta[] = [
  { path: "/", kind: "home", title: "fraktul: maps of software you can dive into", description: "One model file describes your system. fraktul checks it against the code and draws a map you click through, down to a line of source, with narrated tours." },
  { path: "/features", kind: "page", title: "Features · fraktul", description: "What fraktul does, with screenshots of live maps: every level from system to function, a check against code and traces, narrated tours, 3D and deep links." },
  { path: "/ai", kind: "page", title: "Mapping with AI · fraktul", description: "Give your AI coding assistant the fraktul skill and ask for a map. It reads the code and writes the model; a check proves everything it named is real." },
  { path: "/living-docs", kind: "page", title: "Documentation that stays true · fraktul", description: "Architecture diagrams go stale because nothing fails when they are wrong. fraktul checks the map against the code and your OpenTelemetry traces." },
  { path: "/docs", kind: "page", title: "Documentation · fraktul", description: "How to map a system with fraktul: a quickstart, the concepts, the model file, tours and narration, publishing, and every command." },
  { path: "/map", kind: "page", title: "fraktul, mapped with fraktul", description: "The live demo: fraktul's own architecture as a map you can click into, tour and listen to, built by fraktul from one model file." },
  // Internal: not linked, not indexed, and left out of production (scripts/internal-pages.ts).
  { path: "/design", kind: "none", title: "Design system · fraktul (internal)", description: "fraktul's two styles, flat and y2k, in light and dark: tokens, type, controls and the rules that keep text readable." },
  { path: "/404", kind: "none", title: "Not found · fraktul", description: "This page is not on the map." },
];

/** Every page of fraktul.dev that a reader can land on, docs included. */
export function sitePages(): PageMeta[] {
  return [...PAGES, ...loadDocs().map((d) => ({ path: `/docs/${d.slug}`, kind: "doc" as const, title: `${d.title} · fraktul docs`, description: d.summary, section: d.section }))];
}

export function pageMeta(path: string): PageMeta {
  const clean = path.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/(.)\/$/, "$1") || "/";
  return sitePages().find((p) => p.path === clean) ?? { path: clean, kind: "none", title: SITE_NAME, description: TAGLINE };
}

function structuredData(page: PageMeta, site: string): unknown[] {
  const url = site + (page.path === "/" ? "/" : page.path);
  if (page.kind === "home") {
    return [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${site}/`, description: TAGLINE },
      {
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, url: `${site}/`, description: page.description,
        applicationCategory: "DeveloperApplication", operatingSystem: "macOS, Linux, Windows", license: "https://opensource.org/license/mit",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, downloadUrl: "https://www.npmjs.com/package/fraktul",
      },
    ];
  }
  if (page.kind === "doc") {
    return [
      { "@context": "https://schema.org", "@type": "TechArticle", headline: page.title.replace(/ · fraktul docs$/, ""), description: page.description, url, isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${site}/` } },
      {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "Documentation", item: `${site}/docs` },
          { "@type": "ListItem", position: 3, name: page.title.replace(/ · fraktul docs$/, ""), item: url },
        ],
      },
    ];
  }
  return [];
}

/** The head tags for one page. `site` is the site's origin without a trailing slash, or undefined when unknown. */
export function seoTags(path: string, site?: string): SafeHtml {
  const page = pageMeta(path);
  const origin = site?.replace(/\/$/, "");
  const url = origin ? origin + (page.path === "/" ? "/" : page.path) : undefined;
  const indexable = page.kind !== "none";
  return html`<title>${page.title}</title>
<meta name="description" content="${page.description}" />
${url && indexable ? html`<link rel="canonical" href="${url}" />` : ""}
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="${page.kind === "doc" ? "article" : "website"}" />
<meta property="og:title" content="${page.title}" />
<meta property="og:description" content="${page.description}" />
${url ? html`<meta property="og:url" content="${url}" />` : ""}
${origin ? html`<meta property="og:image" content="${origin}/og.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${OG_ALT}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${page.title}" />
<meta name="twitter:description" content="${page.description}" />
${origin ? html`<meta name="twitter:image" content="${origin}/og.png" />
<meta name="twitter:image:alt" content="${OG_ALT}" />` : ""}
${origin ? structuredData(page, origin).map((d) => html`<script type="application/ld+json">${json(d)}</script>`) : ""}`;
}
