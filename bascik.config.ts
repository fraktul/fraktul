import { defineConfig } from "@bascik/bascik/config";
import { dirname, resolve } from "node:path";

// bin/fraktul.ts sets FRAKTUL_MODEL to the project's model file; without it the example in this repo is used.
const model = resolve(process.env.FRAKTUL_MODEL ?? "example/model.yaml");
// FRAKTUL_SITE=1 builds fraktul.dev (home page, design system, fraktul's own map) instead of a project's map.
const site = !!process.env.FRAKTUL_SITE;

export default defineConfig({
  // Each model (and the site) builds into its own folder, so several maps can run at once.
  directory: { pages: site ? "src/site" : "src/pages", out: process.env.FRAKTUL_OUT ?? "dist" },
  // A tool page, not a public site: no sitemap or robots.txt, so no site URL is needed.
  generate: { sitemap: false, robots: false },
  assets: {
    // One self-contained page: it is also published as a single file.
    inlineStyles: site
      ? ["src/pages/css/tokens.css", "src/pages/css/explorer.css", "src/site/css/site.css"]
      : ["src/pages/css/tokens.css", "src/pages/css/explorer.css"],
  },
  pipeline: {
    // Rebuild in dev when the model, its live module or fraktul's own code changes.
    watchPaths: ["src/lib/", dirname(model)],
    exec: [
      // Narration audio and recorded walkthroughs are copied next to the page.
      { script: "scripts/copy-media.ts", phase: "post", watch: [dirname(model)] },
    ],
  },
  scripts: {
    // The data script reads the model (picked by FRAKTUL_MODEL), git and many source files, none of which the build
    // cache can see, so it always runs (about 0.3 s).
    cache: { enabled: false },
  },
});
