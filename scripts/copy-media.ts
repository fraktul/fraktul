// Post-build: copies narration audio (<model dir>/.fraktul/voice/*.mp3) and recorded walkthroughs
// (<model dir>/recordings/*.webm) into the built site, beside the page.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
