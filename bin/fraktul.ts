#!/usr/bin/env node
// fraktul: an explorable map of a software system, drawn from one model file and the code itself.
//
//   fraktul check  [model] [--strict] [--json]   every anchor, diagram box and tour step must exist
//   fraktul dev    [model] [--port 8080]         live map, rebuilt when the model or the code changes
//   fraktul build  [model] [--out dir]           one self-contained page (+ voice/ and recordings/)
//   fraktul artifact [model] [--out dir]         the page without <html>/<head>, for a claude.ai Artifact
//   fraktul voice  [model] [--tour id] [--voice name] [--setup]   speak the tours' narration (local, Kokoro on MLX)
//   fraktul import-recording <file.json> [model] a walkthrough saved from the map's recorder → recordings/
//
// [model] defaults to ./model.yaml, then ./docs/arch/model.yaml.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRAKTUL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, ...rest] = process.argv.slice(2);
const flags = new Map<string, string | true>();
const args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith("--")) { const v = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true; flags.set(a.slice(2), v); }
  else args.push(a);
}

function modelPath(arg?: string): string {
  const c = arg ? [arg] : ["model.yaml", "docs/arch/model.yaml"];
  for (const p of c) if (existsSync(p)) return resolve(p);
  console.error(`No model file: ${c.join(" or ")}. Pass its path: fraktul ${cmd} path/to/model.yaml`);
  process.exit(2);
}
function ensureDeps() {
  if (!existsSync(join(FRAKTUL, "node_modules", "@bascik", "bascik"))) {
    console.log("fraktul: installing its dependencies (npm ci)…");
    const r = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: FRAKTUL, stdio: "inherit" });
    if (r.status) process.exit(r.status);
  }
}
function bascik(model: string, bArgs: string[]) {
  ensureDeps();
  const bin = join(FRAKTUL, "node_modules", "@bascik", "bascik", "bin", "bascik.js");
  return spawnSync(process.execPath, [bin, ...bArgs], { cwd: FRAKTUL, stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model } });
}
function build(model: string, out: string) {
  const r = bascik(model, ["--build"]);
  if (r.status) process.exit(r.status);
  rmSync(out, { recursive: true, force: true });
  cpSync(join(FRAKTUL, "dist"), out, { recursive: true });
  console.log(`fraktul: built ${join(out, "index.html")}`);
}

switch (cmd) {
  case "check": {
    const model = modelPath(args[0]);
    const r = spawnSync(process.execPath, [join(FRAKTUL, "scripts", "check-model.ts"), ...rest.filter((a) => a.startsWith("--"))], { stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model } });
    process.exit(r.status ?? 1);
  }
  case "dev": {
    const model = modelPath(args[0]);
    const port = String(flags.get("port") ?? "8080");
    process.exit(bascik(model, ["--port", port, "--no-pin"]).status ?? 1);
  }
  case "build": {
    const model = modelPath(args[0]);
    build(model, resolve(String(flags.get("out") ?? "fraktul-dist")));
    break;
  }
  case "artifact": {
    const model = modelPath(args[0]);
    const out = resolve(String(flags.get("out") ?? "fraktul-dist"));
    build(model, out);
    const page = readFileSync(join(out, "index.html"), "utf8");
    const head = (page.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "").replace(/<meta charset[^>]*>/i, "").replace(/<meta name="viewport"[^>]*>/i, "");
    const body = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
    writeFileSync(join(out, "artifact.html"), `${head}\n${body}\n`);
    console.log(`fraktul: ${join(out, "artifact.html")} (${Math.round((head.length + body.length) / 1024)} KB); publish voice/ and recordings/ beside it`);
    break;
  }
  case "voice": {
    const model = modelPath(args[0]);
    const py = join(FRAKTUL, "voice", ".venv", "bin", "python");
    if (flags.has("setup") || !existsSync(py)) {
      console.log("fraktul voice: setting up the local voice engine (uv venv + mlx-audio + Kokoro, first time only)…");
      const steps: [string, string[]][] = [
        ["uv", ["venv", "-q", "-p", "3.13", join(FRAKTUL, "voice", ".venv")]],
        ["uv", ["pip", "install", "-q", "-p", py, "-r", join(FRAKTUL, "voice", "requirements.txt")]],
      ];
      for (const [c, a] of steps) { const r = spawnSync(c, a, { stdio: "inherit" }); if (r.status) process.exit(r.status); }
    }
    const r = spawnSync(process.execPath, [join(FRAKTUL, "scripts", "voice.ts"), ...rest.filter((a) => a !== args[0])], { stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model, FRAKTUL_PY: py } });
    process.exit(r.status ?? 1);
  }
  case "import-recording": {
    const file = args[0];
    if (!file || !existsSync(file)) { console.error("Usage: fraktul import-recording <walkthrough.json> [model]"); process.exit(2); }
    const model = modelPath(args[1]);
    const rec = JSON.parse(readFileSync(file, "utf8"));
    const dir = join(dirname(model), "recordings");
    mkdirSync(dir, { recursive: true });
    const id = String(rec.id).replace(/[^a-z0-9-]/gi, "-");
    const ext = rec.mime?.includes("mp4") ? "m4a" : "webm";
    writeFileSync(join(dir, `${id}.${ext}`), Buffer.from(rec.audio, "base64"));
    delete rec.audio;
    rec.file = `${id}.${ext}`;
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(rec, null, 2) + "\n");
    console.log(`fraktul: saved ${join(dir, `${id}.json`)} and ${rec.file}. Rebuild the map to include it.`);
    break;
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 12).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(cmd ? 2 : 0);
}
