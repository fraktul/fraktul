#!/usr/bin/env node
// fraktul: an explorable map of a software system, drawn from one model file and the code itself.
//
//   fraktul init   [model] [--force]             a starter model from the project's folders (default docs/arch/model.yaml)
//   fraktul check  [model] [--strict] [--json]   every anchor, diagram box and tour step must exist
//   fraktul dev    [model] [--port 8080]         live map, rebuilt when the model or the code changes
//   fraktul build  [model] [--out dir]           one self-contained page (+ voice/ and recordings/)
//   fraktul artifact [model] [--out dir]         the page without <html>/<head>, for a claude.ai Artifact
//   fraktul voice  [model] [--tour id] [--voice name] [--setup]   speak the tours' narration (local, Kokoro on MLX)
//   fraktul import-recording <file.json> [model] a walkthrough saved from the map's recorder → recordings/
//
// [model] defaults to ./model.yaml, then ./docs/arch/model.yaml.  --version prints the version.
// Installed from npm: `npx fraktul check`, or `fraktul` from a package.json script. Docs: https://fraktul.dev/docs

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRAKTUL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [first, ...rest] = process.argv.slice(2);
// `fraktul --help` and `fraktul help` print the commands; `--version` and `-v` the version.
const cmd = first === "--help" || first === "-h" || first === "help" ? undefined : first === "-v" ? "--version" : first;
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
/** Bascik's CLI: found the way Node finds packages, so it works from a checkout and from an installed package. */
function bascikBin(): string | null {
  try {
    let dir = dirname(createRequire(import.meta.url).resolve("@bascik/bascik"));
    while (dir !== dirname(dir) && !existsSync(join(dir, "bin", "bascik.js"))) dir = dirname(dir);
    return existsSync(join(dir, "bin", "bascik.js")) ? join(dir, "bin", "bascik.js") : null;
  } catch { return null; }
}
function ensureDeps() {
  // A fresh checkout installs its own dependencies once; an installed package already has them.
  if (!bascikBin() && existsSync(join(FRAKTUL, "package-lock.json"))) {
    console.log("fraktul: installing its dependencies (npm ci)…");
    const r = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: FRAKTUL, stdio: "inherit" });
    if (r.status) process.exit(r.status);
  }
}
/** .ts in a checkout, .js in the published package. */
const EXT = import.meta.url.endsWith(".js") ? ".js" : ".ts";
const outFor = (model: string) => join(FRAKTUL, ".out", process.env.FRAKTUL_SITE ? "site" : createHash("sha1").update(model).digest("hex").slice(0, 10));
function bascik(model: string, bArgs: string[]) {
  ensureDeps();
  const bin = bascikBin();
  if (!bin) { console.error("fraktul: cannot find @bascik/bascik. Run npm install."); process.exit(1); }
  return spawnSync(process.execPath, [bin, ...bArgs], { cwd: FRAKTUL, stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model, FRAKTUL_OUT: outFor(model) } });
}
function build(model: string, out: string) {
  const r = bascik(model, ["--build"]);
  if (r.status) process.exit(r.status);
  rmSync(out, { recursive: true, force: true });
  cpSync(outFor(model), out, { recursive: true });
  console.log(`fraktul: built ${join(out, "index.html")}`);
}

switch (cmd) {
  case "--version": {
    console.log(JSON.parse(readFileSync(join(FRAKTUL, "package.json"), "utf8")).version);
    break;
  }
  case "init": {
    const target = resolve(args[0] ?? "docs/arch/model.yaml");
    if (existsSync(target) && !flags.has("force")) { console.error(`fraktul: ${relative(process.cwd(), target)} already exists. Pass --force to replace it.`); process.exit(2); }
    const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    let top: string;
    try { top = git("rev-parse", "--show-toplevel"); } catch { console.error("fraktul: this folder is not in a git repository. fraktul reads only files git tracks: run `git init` and commit first."); process.exit(2); }
    const { starterModel } = await import(`../src/lib/init${EXT}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, starterModel(basename(top), git("-C", top, "ls-files").split("\n").filter(Boolean)));
    const shown = relative(process.cwd(), target);
    const arg = ["model.yaml", join("docs", "arch", "model.yaml")].includes(shown) ? "" : ` ${shown}`;
    console.log(`fraktul: wrote ${shown}\n\n  Replace the TODOs and draw the arrows, then:\n    fraktul check${arg}   every file it names must exist\n    fraktul dev${arg}     open the map\n\n  The model file: https://fraktul.dev/docs/model`);
    break;
  }
  case "check": {
    const model = modelPath(args[0]);
    const r = spawnSync(process.execPath, [join(FRAKTUL, "scripts", `check-model${EXT}`), ...rest.filter((a) => a.startsWith("--"))], { stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model } });
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
    // An Artifact runs its page alone, so Mermaid goes inside it (a map on a host loads it from vendor/ after painting).
    const mermaidJs = readFileSync(join(out, "vendor", "mermaid.min.js"), "utf8").replace(/<\/script/gi, "<\\/script");
    writeFileSync(join(out, "artifact.html"), `${head}\n<script>${mermaidJs}</script>\n${body}\n`);
    console.log(`fraktul: ${join(out, "artifact.html")} (Mermaid inlined); publish voice/ and recordings/ beside it`);
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
    const r = spawnSync(process.execPath, [join(FRAKTUL, "scripts", `voice${EXT}`), ...rest.filter((a) => a !== args[0])], { stdio: "inherit", env: { ...process.env, FRAKTUL_MODEL: model, FRAKTUL_PY: py } });
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
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(cmd ? 2 : 0);
}
