// The page title and description come from the model (title:, and the root node's summary); the fonts are fraktul's own.
import { html } from "@bascik/bascik/html";
import { fontTags } from "./fonts.ts";
import { loadModel } from "./model.ts";

/** A summary cut to what a search result or link preview shows, at a word. */
const brief = (s: string) => (s.length <= 158 ? s : `${s.slice(0, 157).replace(/\s+\S*$/, "")}…`);

export default function () {
  const m = loadModel();
  const title = m.title ?? "System map";
  const description = brief((m.nodes[m.root]?.summary ?? "An explorable map of a software system, from the whole down to the source code.").replace(/\s+/g, " ").trim());
  // Where the map will be published, when the build is told (FRAKTUL_URL): link previews and search engines use it.
  const url = process.env.FRAKTUL_URL;
  return html`<title>${title}</title><meta name="description" content="${description}" />
${url ? html`<link rel="canonical" href="${url}" /><meta property="og:url" content="${url}" />` : ""}
<meta property="og:type" content="website" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" />
${fontTags("vendor/fonts/")}`;
}
