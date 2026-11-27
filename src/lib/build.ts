// Everything the explorer page needs, built from the model and the repos it points at. Diagrams for files and
// functions are generated here from the code, so the deepest levels never go out of date.

import { compareTraces, loadObserved, serviceNodes, type ObservedEdge } from "./traces.ts";
import { GROUP_OVER, groupFile, type Group, type Section } from "./groups.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { callsOf, langOf, readCode, type CodeFile } from "./code.ts";
import { readLive, type Live } from "./live.ts";
import { parseFlowchart, type Parsed } from "./mermaid.ts";
import { sourceUrl, type Remote } from "./remote.ts";
import { anchorsOf, fileKey, filesOf, fnKey, headOf, loadModel, parseRef, remoteOf, repoRoot, type Model, type ModelNode, type Ref, type Tour } from "./model.ts";

/** A repo as the page sees it: `remote` is its web home (null when unknown), `host` labels links ("GitHub"). */
export type SiteRepo = { title: string; github: string | null; present: boolean; remote: string | null; host: string | null; restricted: boolean };
export type Diagram = Parsed & { title: string; targets: Record<string, string>; generated?: boolean };
export type FileInfo = { key: string; repo: string; path: string; lang: string; lines: number; doc: string; functions: string[]; imports: string[]; importedBy: string[]; url: string | null; excerpt?: string; exists: boolean };
export type FnInfo = { key: string; file: string; name: string; line: number; end: number; doc: string; params: string; exported: boolean; code: string; calls: string[]; calledBy: string[]; url: string | null };
/** A group of a big file's functions, drawn as its own level (groups.ts). */
export type PartInfo = { key: string; file: string; title: string; note: string; functions: string[] };
export type NodeInfo = Omit<ModelNode, "diagram" | "anchors"> & { id: string; anchors: { kind: string; key: string; label: string; missing?: boolean }[]; usedIn: string[] };
export type Site = {
  meta: { built: string; commit: string | null; root: string; home: string | null; repos: Record<string, SiteRepo>; defaultRepo: string; title: string; brand: string; voice: unknown };
  nodes: Record<string, NodeInfo>;
  diagrams: Record<string, Diagram>;
  files: Record<string, FileInfo>;
  fns: Record<string, FnInfo>;
  parts: Record<string, PartInfo>;
  live: Live;
  tours: Tour[];
  /** Narration audio per tour and step (fraktul voice), when rendered. */
  voice: Record<string, { voice: string; steps: Record<string, { file: string; duration: number; cues: { t: number; focus: string[] }[]; captions: { t: number; end: number; text: string }[] }> }>;
  /** Walkthroughs people recorded in the map (recordings/*.json). */
  recordings: { id: string; title: string; summary?: string; by?: string; recorded?: string; duration: number; file: string; events: unknown[] }[];
};

const q = (s: string) => `"${s.replace(/"/g, "#quot;").replace(/[<>]/g, (c) => (c === "<" ? "#lt;" : "#gt;"))}"`;

/** Anchor string → the key the explorer opens. */
export function targetOf(a: string, defaultRepo: string): string {
  if (/^adr:\d+$/.test(a)) return `adr:${a.slice(4).padStart(4, "0")}`;
  const r = parseRef(a, defaultRepo);
  return r.fn ? fnKey(r) : fileKey(r);
}

export async function buildSite(model: Model = loadModel()): Promise<Site> {
  const D = model.default_repo!;
  const live = await readLive(model);
  // Links are pinned to the commit that was read; a repo not checked out links to its default branch.
  const remotes: Record<string, { remote: Remote | null; head: string | null }> = {};
  const remoteFor = (repo: string) => (remotes[repo] ??= { remote: remoteOf(model, repo).remote, head: headOf(model, repo) });
  const urlOf = (repo: string, path: string, from?: number, to?: number) => {
    const { remote, head } = remoteFor(repo);
    return remote ? sourceUrl(remote, path, head, from, to) : null;
  };
  for (const a of live.adrs) a.url = urlOf(D, a.file);

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
    // Repos marked private: the site names the file, never its contents.
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
  const parts: Record<string, PartInfo> = {};
  for (const f of Object.values(files)) {
    if (!f.exists || !f.functions.length) continue;
    if (f.functions.length <= GROUP_OVER) { diagrams[f.key] = genFile(f, fns); continue; }
    const g = genGrouped(f, fns, code.get(f.key)?.cf.sections ?? []);
    Object.assign(diagrams, g.diagrams);
    for (const p of g.parts) parts[p.key] = p;
  }
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

  // What traces saw (fraktul traces): each block that stands for a service shows its real traffic, and the top of
  // the map says what the traces show that the model does not.
  const observed = loadObserved(model);
  if (observed) {
    const nodeOf = serviceNodes(model);
    const name = (s: string) => (nodeOf.has(s) ? model.nodes[nodeOf.get(s)!].title : s);
    const when = observed.from ? `${observed.from.slice(0, 10)}${observed.to && observed.to.slice(0, 10) !== observed.from.slice(0, 10) ? ` to ${observed.to.slice(0, 10)}` : ""}` : "";
    const source = `${model.traces ?? "traces.json"}${when ? ` · traces from ${when}` : ""}`;
    const note = (e: ObservedEdge) => `${e.calls.toLocaleString("en")} call${e.calls === 1 ? "" : "s"} · ${e.via.join(", ")} · p95 ${e.p95} ms${e.errors ? ` · ${e.errors} failed` : ""}`;
    for (const [id, n] of Object.entries(model.nodes)) {
      const mine = [n.service ?? []].flat();
      if (!mine.length) continue;
      const seen = mine.filter((s) => observed.services[s]);
      const spans = seen.reduce((t, s) => t + observed.services[s].spans, 0), errors = seen.reduce((t, s) => t + observed.services[s].errors, 0);
      const out = observed.edges.filter((e) => mine.includes(e.from) && !mine.includes(e.to)), into = observed.edges.filter((e) => mine.includes(e.to) && !mine.includes(e.from));
      const key = (s: string) => (nodeOf.has(s) ? { key: `node:${nodeOf.get(s)}` } : {});
      live.blocks[`traces:${id}`] = {
        title: "Seen in traces",
        rows: seen.length ? [["Service", mine.join(", ")], ["Spans", spans.toLocaleString("en")], ["Failed", `${errors.toLocaleString("en")} (${spans ? Math.round((1000 * errors) / spans) / 10 : 0}%)`], ...(seen[0] && observed.services[seen[0]].language ? [["Written in", observed.services[seen[0]].language!] as [string, string]] : [])] : [["Service", `${mine.join(", ")} (not in the traces)`]],
        list: [...into.map((e) => ({ label: `← ${name(e.from)}`, note: note(e), ...key(e.from) })), ...out.map((e) => ({ label: `→ ${name(e.to)}`, note: note(e), ...key(e.to) }))],
        source,
      };
      nodes[id].live = [...(nodes[id].live ?? []), `traces:${id}`];
    }
    const cmp = compareTraces(model, observed);
    live.blocks.traces = {
      title: `${Object.values(observed.services).filter((s) => !s.external).length} services seen in traces`,
      rows: [["Traces", observed.traces.toLocaleString("en")], ["Spans", observed.spans.toLocaleString("en")], ["Calls between services", String(observed.edges.length)], ["Drawn on the map", `${observed.edges.length ? Math.round((100 * (observed.edges.filter((e) => nodeOf.has(e.from) && nodeOf.has(e.to)).length - cmp.undrawn.length)) / observed.edges.length) : 100}%`]],
      list: [...cmp.undrawn.map((u) => ({ label: `${model.nodes[u.from].title} → ${model.nodes[u.to].title}`, note: "happens, but no diagram draws it", key: `node:${u.from}` })), ...cmp.unmapped.map((s) => ({ label: s, note: "in the traces, not on the map" }))],
      source,
    };
    if (nodes[model.root]) nodes[model.root].live = [...(nodes[model.root].live ?? []), "traces"];
  }

  // A public build (FRAKTUL_PUBLIC=1, used for fraktul.dev while its repos are private) keeps the structure of the map,
  // files, functions and who calls whom, but leaves out source code, file excerpts and links into the repos.
  if (process.env.FRAKTUL_PUBLIC) {
    for (const f of Object.values(fns)) { f.code = ""; f.url = null; }
    for (const f of Object.values(files)) { delete f.excerpt; f.url = null; }
  }
  const repos: Site["meta"]["repos"] = {};
  for (const [k, r] of Object.entries(model.repos)) {
    const { remote } = remoteFor(k);
    const github = remote?.kind === "github" && remote.web.startsWith("https://github.com/") ? remote.web.slice("https://github.com/".length) : null;
    repos[k] = process.env.FRAKTUL_PUBLIC
      ? { title: r.title ?? k, github: null, present: !!repoRoot(model, k), remote: null, host: null, restricted: true }
      : { title: r.title ?? k, github, present: !!repoRoot(model, k), remote: remote?.web ?? null, host: remote?.label ?? null, restricted: !!r.remote_private };
  }
  if (process.env.FRAKTUL_PUBLIC) for (const a of live.adrs) a.url = null;
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
  return { voice, recordings, meta: { built: new Date().toISOString(), commit: headOf(model, D), root: model.root, home: model.home ?? (process.env.FRAKTUL_SITE ? "/" : null), repos, defaultRepo: D, title: model.title ?? "System map", brand: model.brand ?? model.title ?? "System map", voice: model.voice ?? null }, nodes, diagrams, files, fns, parts, live, tours: model.tours };
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

/** A file's functions and the calls between them. A big file is drawn as groups instead (genGrouped). */
function genFile(f: FileInfo, fns: Record<string, FnInfo>): Diagram {
  const mine = f.key.replace(/^file:/, "fn:") + "#";
  const shown = f.functions.map((n) => mine + n).filter((k) => fns[k]);
  const body: string[] = [];
  const targets: Record<string, string> = {};
  const idOf = new Map<string, string>();
  let n = 0;
  const idFor = (k: string) => { if (!idOf.has(k)) { const id = `g${n++}`; idOf.set(k, id); targets[id] = k; } return idOf.get(k)!; };
  body.push(`subgraph here[${q(f.path)}]`);
  for (const k of shown) body.push(`${idFor(k)}[${fnLabel(fns[k])}]:::${fns[k].exported ? "fnx" : "fn"}`);
  body.push("end");
  const ext = new Map<string, string[]>();
  for (const k of shown) for (const c of fns[k].calls) if (!c.startsWith(mine)) { const file = fns[c].file; ext.set(file, [...new Set([...(ext.get(file) ?? []), c])]); }
  let e = 0;
  for (const [file, cs] of ext) {
    body.push(`subgraph x${e++}[${q(file.split(":").slice(2).join(":"))}]`);
    for (const c of cs) body.push(`${idFor(c)}[${fnLabel(fns[c])}]:::ext`);
    body.push("end");
  }
  for (const k of shown) for (const c of fns[k].calls) if (idOf.has(c)) body.push(`${idOf.get(k)} --> ${idOf.get(c)}`);
  return make(f.path.split("/").pop()!, "flowchart LR", body, targets);
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
/** A box with a small second line. `title` may come from a source comment, so it is escaped. */
const twoLine = (title: string, small: string) => `"${title.replace(/"/g, "#quot;").replace(/[<>]/g, (c) => (c === "<" ? "#lt;" : "#gt;"))}<br/><small>${small}</small>"`;

/**
 * A big file, drawn as a person would draw it (groups.ts): an overview with one box per group of functions and one
 * line between two groups however many calls there are, then one diagram per group. Lines to helpers used all over
 * the file are left out; a function's own page still lists every call.
 */
function genGrouped(f: FileInfo, fns: Record<string, FnInfo>, sections: Section[]): { diagrams: Record<string, Diagram>; parts: PartInfo[] } {
  const mine = f.key.replace(/^file:/, "fn:") + "#";
  const own = f.functions.map((n) => mine + n).filter((k) => fns[k]);
  const { groups, helpers } = groupFile(own.map((k) => ({ key: k, name: fns[k].name, line: fns[k].line, exported: fns[k].exported, calls: fns[k].calls, calledBy: fns[k].calledBy })), sections);
  const name = f.path.split("/").pop()!;
  const partKey = (g: Group) => `part:${f.key.slice(5)}#${g.slug}`;
  const groupOf = new Map<string, number>();
  groups.forEach((g, i) => g.fns.forEach((k) => groupOf.set(k, i)));
  const fileOf = (k: string) => fns[k].file;
  const fileName = (key: string) => key.split(":").slice(2).join(":").split("/").pop()!;
  const diagrams: Record<string, Diagram> = {};

  // The overview: groups, and how strongly each leans on another.
  const weight = new Map<string, number>();
  const bump = (a: string, b: string) => weight.set(`${a}>${b}`, (weight.get(`${a}>${b}`) ?? 0) + 1);
  for (const k of own) for (const c of fns[k].calls) {
    if (helpers.has(c)) continue;
    if (c.startsWith(mine)) { if (groupOf.get(c) !== groupOf.get(k)) bump(`p${groupOf.get(k)}`, `p${groupOf.get(c)}`); }
    else bump(`p${groupOf.get(k)}`, `file ${fileOf(c)}`);
  }
  const all = [...weight.entries()].map(([k, n]) => ({ from: k.split(">")[0], to: k.split(">")[1], n })).sort((a, b) => b.n - a.n);
  // Keep the lines that carry the flow: every strong one, and each box's strongest, so nothing floats loose.
  let floor = 2;
  const pick = () => { const best = new Set<object>(); for (const end of new Set(all.flatMap((e) => [e.from, e.to]))) { const top = all.find((e) => e.from === end || e.to === end); if (top) best.add(top); } return all.filter((e) => e.n >= floor || best.has(e)); };
  let lines = pick();
  while (lines.length > groups.length * 1.6 + 2 && floor < 12) { floor++; lines = pick(); }
  const body: string[] = [`subgraph here[${q(f.path)}]`];
  const targets: Record<string, string> = {};
  groups.forEach((g, i) => { body.push(`p${i}[${twoLine(g.title, plural(g.fns.length, "function"))}]:::part`); targets[`p${i}`] = partKey(g); });
  body.push("end");
  const extIds = new Map<string, string>();
  for (const e of lines) if (e.to.startsWith("file ") && !extIds.has(e.to)) { const id = `x${extIds.size}`; extIds.set(e.to, id); targets[id] = e.to.slice(5); body.push(`${id}[${q(fileName(e.to.slice(5)))}]:::ext`); }
  for (const e of lines) body.push(`${e.from} ${e.n >= 4 ? "==>" : "-->"} ${extIds.get(e.to) ?? e.to}`);
  diagrams[f.key] = make(name, groups.length > 6 ? "flowchart TD" : "flowchart LR", body, targets);

  // One diagram per group: its functions and the calls among them, with the rest of the file as single boxes.
  groups.forEach((g, gi) => {
    const b: string[] = [`subgraph here[${q(`${g.title} · ${name}`)}]`];
    const t: Record<string, string> = {};
    const id = new Map<string, string>();
    g.fns.forEach((k, i) => { id.set(k, `g${i}`); t[`g${i}`] = k; b.push(`g${i}[${fnLabel(fns[k])}]:::${fns[k].exported ? "fnx" : "fn"}`); });
    b.push("end");
    const edges = new Set<string>();
    const around = new Map<string, string>();
    const box = (key: string, label: string, cls: string) => { if (!around.has(key)) { const x = `n${around.size}`; around.set(key, x); t[x] = key; b.push(`${x}[${label}]:::${cls}`); } return around.get(key)!; };
    const groupBox = (o: number) => box(partKey(groups[o]), twoLine(groups[o].title, plural(groups[o].fns.length, "function")), "part");
    for (const k of g.fns) {
      for (const c of fns[k].calls) {
        if (helpers.has(c)) continue;
        if (!c.startsWith(mine)) edges.add(`${id.get(k)} --> ${box(fileOf(c), q(fileName(fileOf(c))), "ext")}`);
        else if (groupOf.get(c) === gi) edges.add(`${id.get(k)} --> ${id.get(c)}`);
        else edges.add(`${id.get(k)} --> ${groupBox(groupOf.get(c)!)}`);
      }
      if (!helpers.has(k)) for (const c of fns[k].calledBy) if (c.startsWith(mine) && groupOf.get(c) !== gi) edges.add(`${groupBox(groupOf.get(c)!)} --> ${id.get(k)}`);
    }
    b.push(...edges);
    diagrams[partKey(g)] = make(g.title, "flowchart LR", b, t);
  });
  return { diagrams, parts: groups.map((g) => ({ key: partKey(g), file: f.key, title: g.title, note: g.note, functions: g.fns })) };
}

/** A function with its callers on one side and what it calls on the other. Long lists stand in columns of six. */
function genFn(f: FnInfo, fns: Record<string, FnInfo>): Diagram {
  const body: string[] = [];
  const targets: Record<string, string> = { me: f.key };
  body.push(`me[${fnLabel(f, true)}]:::focus`);
  const COL = 6;
  const side = (keys: string[], id: string, out: boolean) => {
    keys.forEach((c, i) => {
      body.push(`${id}${i}[${fnLabel(fns[c], fns[c].file !== f.file)}]:::${fns[c].file === f.file ? "fn" : "ext"}`, out ? `me --> ${id}${i}` : `${id}${i} --> me`);
      // An invisible link to the box six places back starts a new column instead of one endless row.
      if (i >= COL) body.push(out ? `${id}${i - COL} ~~~ ${id}${i}` : `${id}${i} ~~~ ${id}${i - COL}`);
      targets[`${id}${i}`] = c;
    });
  };
  side(f.calledBy.slice(0, 24), "c", false);
  side(f.calls.slice(0, 30), "k", true);
  return make(`${f.name}()`, "flowchart LR", body, targets);
}

/** Data the check and tests use without building the whole site. */
export function anchorFileExists(model: Model, r: Ref): boolean {
  const root = repoRoot(model, r.repo);
  return !!root && filesOf(model, r.repo).includes(r.path) && existsSync(join(root, r.path));
}
