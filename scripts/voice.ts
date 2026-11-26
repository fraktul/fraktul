// fraktul voice: speaks every tour step that has `say:` narration and writes <model dir>/.fraktul/voice/voice.json.
// Voice settings: `voice:` in the model (engine, model, voice, speed, say_as), a tour's own `voice:`, or --voice.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadModel } from "../src/lib/model.ts";

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const m = loadModel();
const out = join(m.dir, ".fraktul", "voice");
mkdirSync(out, { recursive: true });
const manifestPath = join(out, "voice.json");
const manifest: any = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { tours: {} };
const only = opt("tour");
for (const t of m.tours) {
  if (only && t.id !== only) continue;
  const v = { model: "mlx-community/Kokoro-82M-bf16", voice: "af_heart", speed: 1, ...(m.voice ?? {}), ...((t as any).voice ?? {}), ...(opt("voice") ? { voice: opt("voice") } : {}) };
  const steps = t.steps.filter((s: any) => s.say).map((s: any) => ({ tour: t.id, step: s.id, text: s.say }));
  if (!steps.length) { console.log(`${t.id}: no narration (add say: to its steps)`); continue; }
  console.log(`${t.id}: ${steps.length} steps, voice ${v.voice}`);
  const part = join(out, `.${t.id}.json`);
  const job = { model: v.model, voice: v.voice, speed: v.speed, say_as: (m.voice as any)?.say_as ?? {}, out, steps, manifest: part };
  const r = spawnSync(process.env.FRAKTUL_PY!, [join(import.meta.dirname, "..", "voice", "render.py")], { input: JSON.stringify(job), encoding: "utf8", stdio: ["pipe", "inherit", "inherit"], maxBuffer: 64 << 20 });
  if (r.status) process.exit(r.status);
  manifest.tours[t.id] = { voice: v.voice, model: v.model, rendered: new Date().toISOString(), steps: JSON.parse(readFileSync(part, "utf8")) };
  rmSync(part);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`fraktul voice: ${manifestPath}`);
