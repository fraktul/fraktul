// Post-build, fraktul.dev only: writes llms.txt, the site's pages as one Markdown list for AI assistants and agents
// (https://llmstxt.org). Titles and descriptions come from the same table as the head tags (src/lib/seo.ts).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sitePages, TAGLINE } from "../src/lib/seo.ts";

const site = (process.env.BASCIK_SITE_URL ?? "").replace(/\/$/, "");
const out = process.env.BASCIK_OUT_DIR ?? "dist";
const pages = sitePages();
const line = (p: (typeof pages)[number]) => `- [${p.title.replace(/ · fraktul( docs)?$/, "")}](${site}${p.path}): ${p.description}`;
const sections = [...new Set(pages.filter((p) => p.kind === "doc").map((p) => p.section!))];

writeFileSync(join(out, "llms.txt"), `# fraktul

> ${TAGLINE}. One model file describes a software system as blocks and how they connect. fraktul checks it against the
> code, reads the files, functions and calls below each block from the code itself, and builds one static page where
> people click from the whole system down to a line of source, follow tours, and listen to narrated walkthroughs.

Install with \`npm install --save-dev fraktul\` (Node 24.21 or newer), then \`npx fraktul init\`, \`npx fraktul check\`
and \`npx fraktul dev\`. The model is one YAML file, by default \`docs/arch/model.yaml\`; diagrams are plain Mermaid
flowcharts in which a box whose id is another block opens that block.

## Site

${pages.filter((p) => p.kind === "home" || p.kind === "page").map(line).join("\n")}

${sections.map((s) => `## Docs: ${s}\n\n${pages.filter((p) => p.section === s).map(line).join("\n")}`).join("\n\n")}
`);
console.log(`llms-txt: ${join(out, "llms.txt")}`);
