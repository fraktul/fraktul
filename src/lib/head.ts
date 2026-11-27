// The page title and description come from the model (title:, and the root node's summary); the fonts are fraktul's own.
import { html } from "@bascik/bascik/html";
import { fontTags } from "./fonts.ts";
import { loadModel } from "./model.ts";

export default function () {
  const m = loadModel();
  const title = m.title ?? "System map";
  const description = m.nodes[m.root]?.summary ?? "An explorable map of a software system, from the whole down to the source code.";
  return html`<title>${title}</title><meta name="description" content="${description}" />${fontTags("vendor/fonts/")}`;
}
