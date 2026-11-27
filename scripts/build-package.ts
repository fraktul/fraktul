// node scripts/build-package.ts [out-dir]   (default: package/)
// Builds the npm package. Node does not strip TypeScript inside node_modules, so every file Node itself loads (the CLI,
// the libraries, the build scripts Bascik runs, the Bascik config) is written as JavaScript, with its types stripped by
// Node's own stripper and its `.ts` imports renamed to `.js`. Browser scripts stay TypeScript: Bascik compiles those
// itself. The fraktul.dev site, its docs and the example's audio are not part of the package.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, process.argv[2] ?? "package");

/** Files Node loads: written as .js. */
const NODE_TS = ["bin/fraktul.ts", "bascik.config.ts", "scripts/check-model.ts", "scripts/copy-media.ts", "scripts/voice.ts", "src/components/fraktul-map/data.ts"];
const NODE_TS_DIRS = ["src/lib"];
/** Only fraktul.dev uses these (its documentation pages and head tags): not part of the package. */
const SITE_ONLY = ["docs.ts", "seo.ts", "shots.ts", "features.ts"];
/** Copied as they are. */
const AS_IS = ["src/components/fraktul-map", "src/pages/index.html", "src/pages/favicon.svg", "src/pages/css", "voice/render.py", "voice/requirements.txt", "example/model.yaml", "skills", "README.md", "CHANGELOG.md", "LICENSE"];

const renameImports = (code: string) =>
  code.replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2").replace(/(import\(\s*["'][^"']+)\.ts(["']\s*\))/g, "$1.js$2").replace(/(src=["'][^"']+)\.ts(["'])/g, "$1.js$2");

function writeJs(rel: string) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  // Keep the shebang: Node's stripper wants it at the very start, so set it aside and put it back.
  const bang = src.startsWith("#!") ? src.slice(0, src.indexOf("\n") + 1) : "";
  let js = bang + renameImports(stripTypeScriptTypes(src.slice(bang.length), { mode: "strip" }));
  if (rel === "bascik.config.ts") js = js.replace(/scripts\/copy-media\.ts/g, "scripts/copy-media.js");
  const dest = join(OUT, rel.replace(/\.ts$/, ".js"));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, js);
}

rmSync(OUT, { recursive: true, force: true });
for (const d of NODE_TS_DIRS) for (const f of readdirSync(join(ROOT, d))) if (f.endsWith(".ts") && !f.endsWith(".test.ts") && !SITE_ONLY.includes(f)) writeJs(join(d, f));
for (const p of AS_IS) {
  if (!existsSync(join(ROOT, p))) continue;
  cpSync(join(ROOT, p), join(OUT, p), { recursive: statSync(join(ROOT, p)).isDirectory() });
}
// Node-side files are written as .js last, replacing the .ts copies the folders brought along.
for (const f of NODE_TS) { writeJs(f); rmSync(join(OUT, f), { force: true }); }
// HTML that points Bascik at a Node-side .ts script points at the .js now.
for (const rel of ["src/components/fraktul-map/fraktul-map.html", "src/pages/index.html"]) {
  const p = join(OUT, rel);
  writeFileSync(p, readFileSync(p, "utf8").replace(/(data-bascik-build(?:-once)?\s+src=["'][^"']+)\.ts(["'])/g, "$1.js$2"));
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license ?? "MIT",
  type: "module",
  homepage: pkg.homepage,
  repository: pkg.repository,
  bugs: pkg.bugs,
  author: pkg.author,
  keywords: pkg.keywords,
  engines: pkg.engines,
  bin: { fraktul: "bin/fraktul.js" },
  dependencies: pkg.dependencies,
};
writeFileSync(join(OUT, "package.json"), JSON.stringify(published, null, 2) + "\n");
console.log(`package: ${relative(ROOT, OUT)}/ (${published.name}@${published.version})`);
