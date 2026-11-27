import { defineConfig } from "@bascik/bascik/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// bin/fraktul.ts sets FRAKTUL_MODEL to the project's model file; without it the example in this repo is used.
const model = resolve(process.env.FRAKTUL_MODEL ?? "example/model.yaml");
// FRAKTUL_SITE=1 builds fraktul.dev (home page, design system, fraktul's own map) instead of a project's map.
const site = !!process.env.FRAKTUL_SITE;

export default defineConfig({
  // Each model (and the site) builds into its own folder, so several maps can run at once.
  directory: { pages: site ? "src/site" : "src/pages", out: process.env.FRAKTUL_OUT ?? "dist" },
  // A project's map is a tool page: no sitemap or robots.txt. fraktul.dev gets both (the deploy sets BASCIK_SITE_URL).
  generate: { sitemap: site && !!process.env.BASCIK_SITE_URL, robots: site && !!process.env.BASCIK_SITE_URL },
  assets: {
    // One self-contained page: it is also published as a single file.
    inlineStyles: site
      ? ["src/pages/css/tokens.css", "src/pages/css/explorer.css", "src/site/css/site.css"]
      : ["src/pages/css/tokens.css", "src/pages/css/explorer.css"],
  },
  pipeline: {
    // Rebuild in dev when the model, its live module or fraktul's own code changes.
    watchPaths: ["src/lib/", "content/", dirname(model)].filter((p) => existsSync(p)),
    exec: [
      // Narration audio and recorded walkthroughs are copied next to the page.
      { script: existsSync("scripts/copy-media.ts") ? "scripts/copy-media.ts" : "scripts/copy-media.js", phase: "post", watch: [dirname(model)] },
      // fraktul.dev also publishes llms.txt, its pages as one list for AI assistants.
      ...(site ? [{ script: "scripts/llms-txt.ts", phase: "post" as const }] : []),
      // The design system page is for our own use: built for dev and previews, left out of production.
      ...(site ? [{ script: "scripts/internal-pages.ts", phase: "post" as const }] : []),
    ],
  },
  scripts: {
    // The data script reads the model (picked by FRAKTUL_MODEL), git and many source files, none of which the build
    // cache can see, so it always runs (about 0.3 s).
    cache: { enabled: false },
  },
});
