// Post-build: copies fraktul's own Mermaid, three.js and fonts (vendor/, no CDN), narration audio (<model dir>/.fraktul/voice/*.mp3) and recorded walkthroughs
// (<model dir>/recordings/*.webm) into the built site, beside the page.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { FONTS } from "../src/lib/fonts.ts";

const modelDir = dirname(resolve(process.env.FRAKTUL_MODEL ?? "example/model.yaml"));
const out = process.env.BASCIK_OUT_DIR ?? "dist";
const voice = join(modelDir, ".fraktul", "voice");
if (existsSync(voice)) for (const tour of readdirSync(voice)) {
  const dir = join(voice, tour);
  if (tour === "cache" || !statSync(dir).isDirectory() || !readdirSync(dir).some((f) => f.endsWith(".mp3"))) continue;
  mkdirSync(join(out, "voice", tour), { recursive: true });
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".mp3"))) cpSync(join(dir, f), join(out, "voice", tour, f));
}
const rec = join(modelDir, "recordings");
if (existsSync(rec)) {
  mkdirSync(join(out, "recordings"), { recursive: true });
  for (const f of readdirSync(rec).filter((x) => /\.(webm|m4a|mp3|ogg)$/.test(x))) cpSync(join(rec, f), join(out, "recordings", f));
}

// Mermaid and three.js from fraktul's own dependencies, served beside the page: the map loads no code from a CDN.
function vendor(pkg: string, file: string) {
  let dir = dirname(createRequire(import.meta.url).resolve(pkg));
  while (dir !== dirname(dir) && !existsSync(join(dir, file))) dir = dirname(dir);
  mkdirSync(join(out, "vendor"), { recursive: true });
  cpSync(join(dir, file), join(out, "vendor", file.split("/").pop()!));
}
vendor("mermaid", "dist/mermaid.min.js");
// The fonts too (src/lib/fonts.ts), under vendor/fonts/.
for (const f of FONTS) {
  let dir = dirname(createRequire(import.meta.url).resolve(`${f.pkg}/package.json`));
  mkdirSync(join(out, "vendor", "fonts"), { recursive: true });
  cpSync(join(dir, "files", f.file), join(out, "vendor", "fonts", f.file));
}
vendor("three", "build/three.module.min.js");
