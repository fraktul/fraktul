// Post-build, fraktul.dev only: pages kept for our own use (the design system reference, /design) are built for local
// work and for pull request previews, and left out of production. A production build is one that knows its site URL
// and is not a preview.
import { rmSync } from "node:fs";
import { join } from "node:path";

const INTERNAL = ["design.html"];
const out = process.env.BASCIK_OUT_DIR ?? "dist";
if (process.env.BASCIK_SITE_URL && !process.env.FRAKTUL_PREVIEW) {
  for (const page of INTERNAL) rmSync(join(out, page), { force: true });
  console.log(`internal-pages: left out of production: ${INTERNAL.join(", ")}`);
}
