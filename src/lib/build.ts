// Everything the explorer page needs, built from the model and the repos it points at. Diagrams for files and
// functions are generated here from the code, so the deepest levels never go out of date.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { callsOf, langOf, readCode, type CodeFile } from "./code.ts";
import { readLive, type Live } from "./live.ts";
import { parseFlowchart, type Parsed } from "./mermaid.ts";
import { anchorsOf, fileKey, filesOf, fnKey, headOf, loadModel, parseRef, repoRoot, type Model, type ModelNode, type Ref, type Tour } from "./model.ts";

export type Diagram = Parsed & { title: string; targets: Record<string, string>; generated?: boolean };
export type FileInfo = { key: string; repo: string; path: string; lang: string; lines: number; doc: string; functions: string[]; imports: string[]; importedBy: string[]; url: string | null; excerpt?: string; exists: boolean };
export type FnInfo = { key: string; file: string; name: string; line: number; end: number; doc: string; params: string; exported: boolean; code: string; calls: string[]; calledBy: string[]; url: string | null };
export type NodeInfo = Omit<ModelNode, "diagram" | "anchors"> & { id: string; anchors: { kind: string; key: string; label: string; missing?: boolean }[]; usedIn: string[] };
export type Site = {
  meta: { built: string; commit: string | null; root: string; repos: Record<string, { title: string; github: string | null; present: boolean }>; defaultRepo: string; title: string; brand: string; voice: unknown };
  nodes: Record<string, NodeInfo>;
  diagrams: Record<string, Diagram>;
  files: Record<string, FileInfo>;
  fns: Record<string, FnInfo>;
  live: Live;
  tours: Tour[];
  /** Narration audio per tour and step (fraktul voice), when rendered. */
  voice: Record<string, { voice: string; steps: Record<string, { file: string; duration: number; cues: { t: number; focus: string[] }[]; captions: { t: number; end: number; text: string }[] }> }>;
  /** Walkthroughs people recorded in the map (recordings/*.json). */
  recordings: { id: string; title: string; summary?: string; by?: string; recorded?: string; duration: number; file: string; events: unknown[] }[];
};

const q = (s: string) => `"${s.replace(/"/g, "#quot;").replace(/[<>]/g, (c) => (c === "<" ? "#lt;" : "#gt;"))}"`;
const MAX_FILE_FNS = 70;

/** Anchor string → the key the explorer opens. */
export function targetOf(a: string, defaultRepo: string): string {
  if (/^adr:\d+$/.test(a)) return `adr:${a.slice(4).padStart(4, "0")}`;
  const r = parseRef(a, defaultRepo);
  return r.fn ? fnKey(r) : fileKey(r);
}

export async function buildSite(model: Model = loadModel()): Promise<Site> {
  const D = model.default_repo!;
  const live = await readLive(model);
  const heads: Record<string, string | null> = {};
  const urlOf = (repo: string, path: string, from?: number, to?: number) => {
    const gh = model.repos[repo]?.github;
    if (!gh) return null;
    heads[repo] ??= headOf(model, repo) ?? "main";
    return `https://github.com/${gh}/blob/${heads[repo]}/${path}${from ? `#L${from}-L${to ?? from}` : ""}`;
  };

  // 1. Files: every file an anchor names, then the code files they import (same repo), a few levels deep.
  const files: Record<string, FileInfo> = {};
  const code = new Map<string, { cf: CodeFile; text: string; ref: Ref }>();
  const queue: Ref[] = [];
  for (const n of Object.values(model.nodes)) {
    for (const a of anchorsOf(n, D)) if (typeof a.ref !== "string") queue.push({ repo: a.ref.repo, path: a.ref.path });
    if (n.diagram) for (const v of Object.values(parseFlowchart(n.diagram).links)) if (!v.startsWith("adr:")) { const r = parseRef(v, D); queue.push({ repo: r.repo, path: r.path }); }
  }
  const depth = new Map<string, number>();
  while (queue.length) {
    const r = queue.shift()!;
    const key = fileKey(r);
    if (files[key]) continue;
    const root = repoRoot(model, r.repo);
    const allowed = root ? filesOf(model, r.repo) : [];
    const exists = !!root && allowed.includes(r.path);
    const lang = langOf(r.path);
    const info: FileInfo = { key, repo: r.repo, path: r.path, lang, lines: 0, doc: "", functions: [], imports: [], importedBy: [], url: urlOf(r.repo, r.path), exists };
    files[key] = info;
    // Private folders: the site names the file, never its contents.
    if (!exists || !root || model.repos[r.repo]?.private) continue;
    const text = readFileSync(join(root, r.path), "utf8");
    if (lang === "other") {
      info.lines = text.split("\n").length;
      if (text.length < 400_000) info.excerpt = text.split("\n").slice(0, 80).join("\n").slice(0, 6000);
      continue;
    }
    const cf = readCode(root, r.path, text);
    code.set(key, { cf, text, ref: r });
    Object.assign(info, { lines: cf.lines, doc: cf.doc, functions: cf.functions.map((f) => f.name), imports: cf.importFiles.filter((p) => allowed.includes(p)).map((p) => fileKey({ repo: r.repo, path: p })) });
    const d = depth.get(key) ?? 0;
    if (d < 3) for (const p of cf.importFiles) if (allowed.includes(p)) { const k = fileKey({ repo: r.repo, path: p }); if (!depth.has(k)) depth.set(k, d + 1); queue.push({ repo: r.repo, path: p }); }
  }
  for (const f of Object.values(files)) for (const i of f.imports) files[i]?.importedBy.push(f.key);

  // 2. Functions and who calls whom.
  const fns: Record<string, FnInfo> = {};
  for (const [key, { cf, text, ref }] of code) {
    const src = text.split("\n");
    for (const f of cf.functions) {
      const k = fnKey({ ...ref, fn: f.name });
      if (fns[k]) continue;
      fns[k] = { key: k, file: key, name: f.name, line: f.line, end: f.end, doc: f.doc, params: f.params, exported: f.exported, code: src.slice(f.line - 1, f.end).join("\n").slice(0, 20000), calls: [], calledBy: [], url: urlOf(ref.repo, ref.path, f.line, f.end) };
    }
  }
  for (const [key, { cf, text, ref }] of code) {
    const root = repoRoot(model, ref.repo)!;
    const calls = callsOf(ref.path, text, cf, root, (p) => code.get(fileKey({ repo: ref.repo, path: p }))?.cf ?? null);
    for (const [name, targets] of calls) {
      const from = fnKey({ ...ref, fn: name });
      for (const t of targets) {
        const to = fnKey({ repo: ref.repo, path: t.file, fn: t.name });
        if (!fns[to] || !fns[from]) continue;
        if (!fns[from].calls.includes(to)) fns[from].calls.push(to);
        if (!fns[to].calledBy.includes(from)) fns[to].calledBy.push(from);
      }
    }
  }

  // 3. Diagrams: the model's own, then generated ones for nodes that only name code, files and functions.
  const diagrams: Record<string, Diagram> = {};
  const usedIn: Record<string, string[]> = {};
  for (const [id, n] of Object.entries(model.nodes)) {
    if (!n.diagram) continue;
    const p = parseFlowchart(n.diagram);
    const targets: Record<string, string> = {};
    for (const b of p.ids) {
      if (p.links[b]) targets[b] = targetOf(p.links[b], D);
      else if (model.nodes[b] && b !== id) { targets[b] = `node:${b}`; (usedIn[b] ??= []).push(id); }
    }
    diagrams[`node:${id}`] = { ...p, title: n.title, targets };
  }
  for (const [id, n] of Object.entries(model.nodes)) {
    if (n.diagram) continue;
    const keys = anchorsOf(n, D).filter((a) => a.kind === "files" || a.kind === "functions").map((a) => (typeof a.ref === "string" ? "" : a.ref.fn ? fnKey(a.ref) : fileKey(a.ref))).filter((k) => k && (files[k]?.exists || fns[k]));
    if (keys.length) diagrams[`node:${id}`] = genAnchors(n.title, keys, files, fns);
  }
  for (const f of Object.values(files)) if (f.exists && f.functions.length) diagrams[f.key] = genFile(f, fns);
  for (const f of Object.values(fns)) diagrams[f.key] = genFn(f, fns);

  // 4. Node panels.
  const nodes: Record<string, NodeInfo> = {};
  for (const [id, n] of Object.entries(model.nodes)) {
    const { diagram: _d, anchors: _a, ...rest } = n;
    const anchors = anchorsOf(n, D).map((a) => {
      if (typeof a.ref === "string") { const adr = live.adrs.find((x) => x.num === a.ref); return { kind: "adrs", key: `adr:${a.ref}`, label: adr ? `ADR ${adr.num}: ${adr.title}` : `ADR ${a.ref}`, ...(adr ? {} : { missing: true }) }; }
      const key = a.ref.fn ? fnKey(a.ref) : fileKey(a.ref);
      const present = a.ref.fn ? !!fns[key] : !!files[key]?.exists;
      const repoTag = a.ref.repo === D ? "" : `${a.ref.repo}: `;
      return { kind: a.kind, key, label: `${repoTag}${a.ref.path}${a.ref.fn ? ` → ${a.ref.fn}()` : ""}`, ...(present ? {} : { missing: true }) };
    });
    nodes[id] = { id, ...rest, anchors, usedIn: usedIn[id] ?? [] };
  }

  const repos: Site["meta"]["repos"] = {};
  for (const [k, r] of Object.entries(model.repos)) repos[k] = { title: r.title ?? k, github: r.github ?? null, present: !!repoRoot(model, k) };
  const voicePath = join(model.dir, ".fraktul", "voice", "voice.json");
  const voice = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")).tours ?? {} : {};
  // Narration rendered for steps that no longer exist (or whose text changed) is dropped, not shown out of date.
  for (const [tid, v] of Object.entries(voice) as [string, any][]) {
    const t = model.tours.find((x) => x.id === tid);
    if (!t) { delete voice[tid]; continue; }
    for (const sid of Object.keys(v.steps)) if (!t.steps.some((s) => s.id === sid && s.say)) delete v.steps[sid];
  }
  const recDir = join(model.dir, "recordings");
  const recordings = existsSync(recDir) ? readdirSync(recDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(recDir, f), "utf8"))).filter((r) => r.file && existsSync(join(recDir, r.file))).map((r) => ({ ...r, file: `recordings/${r.file}` })) : [];
  return { voice, recordings, meta: { built: new Date().toISOString(), commit: headOf(model, D), root: model.root, repos, defaultRepo: D, title: model.title ?? "System map", brand: model.brand ?? model.title ?? "System map", voice: model.voice ?? null }, nodes, diagrams, files, fns, live, tours: model.tours };
}

function fnLabel(f: FnInfo, withFile = false): string {
  // Function names and file names are plain identifiers and paths, so the small line can be Mermaid markup.
  const file = f.file.split(":").slice(2).join(":").split("/").pop();
  return `"${f.name}()${withFile ? `<br/><small>${file}</small>` : ""}"`;
}

function make(title: string, header: string, body: string[], targets: Record<string, string>): Diagram {
  const p = parseFlowchart([header, ...body].join("\n"));
  return { ...p, title, targets, generated: true };
}

function genAnchors(title: string, keys: string[], files: Record<string, FileInfo>, fns: Record<string, FnInfo>): Diagram {
  const body: string[] = [];
  const targets: Record<string, string> = {};
  const idOf = new Map<string, string>();
  keys.forEach((k, i) => {
    const id = `a${i}`;
    idOf.set(k, id);
    targets[id] = k;
    if (k.startsWith("fn:")) body.push(`${id}[${fnLabel(fns[k], true)}]:::fn`);
    else { const f = files[k]; body.push(`${id}[${q(f.path.split("/").pop()!)}]:::${f.lang === "other" ? "data" : "file"}`); }
  });
  for (const k of keys) {
    if (k.startsWith("file:")) for (const i of files[k].imports) if (idOf.has(i)) body.push(`${idOf.get(k)} -->|imports| ${idOf.get(i)}`);
    if (k.startsWith("fn:")) for (const c of fns[k].calls) if (idOf.has(c)) body.push(`${idOf.get(k)} -->|calls| ${idOf.get(c)}`);
  }
  return make(`${title}: code`, "flowchart LR", body, targets);
}

function genFile(f: FileInfo, fns: Record<string, FnInfo>): Diagram {
  const own = f.functions.map((n) => `${f.key.replace(/^file:/, "fn:")}#${n}`).filter((k) => fns[k]);
  // Big files: functions that call or are called inside the file first, then exported ones.
  let shown = own;
  if (own.length > MAX_FILE_FNS) {
    const linked = own.filter((k) => fns[k].calls.some((c) => own.includes(c)) || fns[k].calledBy.some((c) => own.includes(c)));
    shown = [...new Set([...linked, ...own.filter((k) => fns[k].exported)])].slice(0, MAX_FILE_FNS);
  }
  const body: string[] = [];
  const targets: Record<string, string> = {};
  const idOf = new Map<string, string>();
  let n = 0;
  const idFor = (k: string) => { if (!idOf.has(k)) { const id = `g${n++}`; idOf.set(k, id); targets[id] = k; } return idOf.get(k)!; };
  body.push(`subgraph here[${q(f.path)}]`);
  for (const k of shown) body.push(`${idFor(k)}[${fnLabel(fns[k])}]:::${fns[k].exported ? "fnx" : "fn"}`);
  body.push("end");
  const ext = new Map<string, string[]>();
  for (const k of shown) for (const c of fns[k].calls) if (!c.startsWith(`${f.key.replace(/^file:/, "fn:")}#`)) { const file = fns[c].file; ext.set(file, [...new Set([...(ext.get(file) ?? []), c])]); }
  let e = 0;
  for (const [file, cs] of ext) {
    body.push(`subgraph x${e++}[${q(file.split(":").slice(2).join(":"))}]`);
    for (const c of cs) body.push(`${idFor(c)}[${fnLabel(fns[c])}]:::ext`);
    body.push("end");
  }
  for (const k of shown) for (const c of fns[k].calls) if (idOf.has(c)) body.push(`${idOf.get(k)} --> ${idOf.get(c)}`);
  return make(f.path.split("/").pop()!, "flowchart LR", body, targets);
}

function genFn(f: FnInfo, fns: Record<string, FnInfo>): Diagram {
  const body: string[] = [];
  const targets: Record<string, string> = { me: f.key };
  body.push(`me[${fnLabel(f, true)}]:::focus`);
  f.calledBy.slice(0, 24).forEach((c, i) => { body.push(`c${i}[${fnLabel(fns[c], fns[c].file !== f.file)}]:::${fns[c].file === f.file ? "fn" : "ext"}`, `c${i} --> me`); targets[`c${i}`] = c; });
  f.calls.slice(0, 30).forEach((c, i) => { body.push(`k${i}[${fnLabel(fns[c], fns[c].file !== f.file)}]:::${fns[c].file === f.file ? "fn" : "ext"}`, `me --> k${i}`); targets[`k${i}`] = c; });
  return make(`${f.name}()`, "flowchart LR", body, targets);
}

/** Data the check and tests use without building the whole site. */
export function anchorFileExists(model: Model, r: Ref): boolean {
  const root = repoRoot(model, r.repo);
  return !!root && filesOf(model, r.repo).includes(r.path) && existsSync(join(root, r.path));
}
