#!/usr/bin/env node
// fraktul: an explorable map of a software system, drawn from one model file and the code itself.
//
//   fraktul init   [model] [--force] [--no-skill] a starter model from the project's folders, and the agent skill
//   fraktul check  [model] [--strict] [--json]   every anchor, diagram box and tour step must exist
//   fraktul dev    [model] [--port 8080]         live map, rebuilt when the model or the code changes
//   fraktul build  [model] [--out dir]           one self-contained page (+ voice/ and recordings/)
//   fraktul artifact [model] [--out dir]         the page without <html>/<head>, for a claude.ai Artifact
//   fraktul voice  [model] [--tour id] [--voice name] [--setup]   speak the tours' narration (local, Kokoro on MLX)
//   fraktul import-recording <file.json> [model] a walkthrough saved from the map's recorder → recordings/
//   fraktul traces <file|folder|jaeger-url>... [--model path] [--mermaid]   what OpenTelemetry traces saw → traces.json
//   fraktul example shop                         put the demo shop's map into a checkout of the OpenTelemetry Demo
//   fraktul skill  [--dir path]                  install the fraktul agent skill, so an AI assistant can write the map
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
    // The agent skill comes along (unless --no-skill), so an AI assistant can do the writing.
    if (!flags.has("no-skill")) for (const dir of [".claude/skills", ".agents/skills"]) cpSync(join(FRAKTUL, "skills", "fraktul"), join(top, dir, "fraktul"), { recursive: true });
    const shown = relative(process.cwd(), target);
    const arg = ["model.yaml", join("docs", "arch", "model.yaml")].includes(shown) ? "" : ` ${shown}`;
    console.log(`fraktul: wrote ${shown}\n\n  Replace the TODOs and draw the arrows, then:\n    fraktul check${arg}   every file it names must exist\n    fraktul dev${arg}     open the map\n\n  The model file: https://fraktul.dev/docs/model${flags.has("no-skill") ? "" : `\n  Or let an AI assistant write it: the fraktul skill is in .claude/skills and .agents/skills. Ask: "Map this system with fraktul."`}`);
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
  case "traces": {
    // Traces in (OTLP JSON files, a folder of them, or a Jaeger address), a small summary out: services and the calls
    // between them. The check and the map compare it with what the model draws.
    const { fetchJaeger, observedMermaid, readSpans, summarize } = await import(`../src/lib/traces${EXT}`);
    if (!args.length) { console.error("Usage: fraktul traces <otlp.json | folder | http://jaeger:16686>... [--model path] [--lookback 1h] [--limit 200] [--mermaid]"); process.exit(2); }
    const spans = [];
    for (const src of args) {
      if (/^https?:\/\//.test(src)) spans.push(...await fetchJaeger(src, { lookback: flags.get("lookback") as string | undefined, limit: flags.has("limit") ? Number(flags.get("limit")) : undefined }));
      else if (existsSync(src)) spans.push(...readSpans(src));
      else { console.error(`fraktul traces: no such file or folder: ${src}`); process.exit(2); }
    }
    if (!spans.length) { console.error("fraktul traces: no spans found. Expected OTLP JSON (the Collector's file exporter) or Jaeger's API JSON."); process.exit(1); }
    const observed = summarize(spans, args.join(", "));
    if (flags.has("mermaid")) { console.log(observedMermaid(observed)); break; }
    const model = flags.has("model") ? modelPath(String(flags.get("model"))) : modelPath();
    const out = join(dirname(model), "traces.json");
    writeFileSync(out, JSON.stringify(observed, null, 2) + "\n");
    const real = Object.values(observed.services).filter((s: any) => !s.external).length;
    console.log(`fraktul: ${relative(process.cwd(), out)}: ${real} services, ${observed.edges.length} calls between them, from ${observed.traces.toLocaleString("en")} traces (${observed.spans.toLocaleString("en")} spans)\n\n  Give each block its service name (service: <name>), then:\n    fraktul check   lists calls the traces show that no diagram draws`);
    break;
  }
  case "example": {
    // The demo shop's map (example/shop), written into a checkout of the OpenTelemetry Demo so anyone can run it.
    if (args[0] !== "shop") { console.error("Usage: fraktul example shop   (run it inside a checkout of github.com/open-telemetry/opentelemetry-demo)"); process.exit(2); }
    if (!existsSync(join("src", "checkout")) || !existsSync(join("src", "frontend"))) { console.error("fraktul example shop: this does not look like the OpenTelemetry Demo (no src/checkout and src/frontend here).\n  git clone --depth 1 --branch 2.1.3 https://github.com/open-telemetry/opentelemetry-demo.git && cd opentelemetry-demo"); process.exit(2); }
    const dir = join("docs", "arch");
    if (existsSync(join(dir, "model.yaml")) && !flags.has("force")) { console.error(`fraktul: ${join(dir, "model.yaml")} already exists. Pass --force to replace it.`); process.exit(2); }
    mkdirSync(dir, { recursive: true });
    // In fraktul's own repo the demo sits in .demo/ and the map links home to fraktul.dev; here the repo is this folder.
    const model = readFileSync(join(FRAKTUL, "example", "shop", "model.yaml"), "utf8").replace('path: ".demo/opentelemetry-demo"', 'path: "."').replace(/^home: .*\n/m, "");
    writeFileSync(join(dir, "model.yaml"), model);
    cpSync(join(FRAKTUL, "example", "shop", "traces.json"), join(dir, "traces.json"));
    console.log(`fraktul: wrote ${join(dir, "model.yaml")} and ${join(dir, "traces.json")}\n\n    fraktul check   the map against the code and the traces\n    fraktul dev     open the map\n\n  About this map: https://fraktul.dev/demo`);
    break;
  }
  case "skill": {
    // The agent skill ships with fraktul; this copies it where coding assistants look for skills.
    const from = join(FRAKTUL, "skills", "fraktul");
    const base = resolve(String(flags.get("dir") ?? "."));
    for (const dir of [".claude/skills", ".agents/skills"]) {
      rmSync(join(base, dir, "fraktul"), { recursive: true, force: true });
      cpSync(from, join(base, dir, "fraktul"), { recursive: true });
      console.log(`fraktul: ${join(relative(process.cwd(), base) || ".", dir, "fraktul")}`);
    }
    console.log(`\n  Ask your assistant: "Map this system with fraktul." It reads the code, writes ${join("docs", "arch", "model.yaml")},\n  and runs fraktul check until every reference resolves.`);
    break;
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
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(cmd ? 2 : 0);
}
