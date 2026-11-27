// Checks the model against the repos: every file, function, ADR and diagram reference must exist, and anything in the
// repo the model does not mention yet is listed.

import { compareTraces, loadObserved, type TraceReport } from "./traces.ts";
import { readCode } from "./code.ts";
import { readAdrs } from "./live.ts";
import { parseFlowchart } from "./mermaid.ts";
import { anchorsOf, filesOf, matches, parseRef, remoteOf, repoRoot, type Model, type Ref, KINDS } from "./model.ts";
import { HOST_KINDS, redact } from "./remote.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Report = { errors: string[]; unmentioned: { files: string[]; adrs: string[] }; skipped: string[]; unreachable: string[]; stats: Record<string, number>; /** The model against what traces saw, when there is a traces summary. */ traces?: TraceReport };

const ID = /^[a-z][a-z0-9_]*$/;

export function checkModel(model: Model): Report {
  const D = model.default_repo!;
  const errors: string[] = [];
  const skipped = new Set<string>();
  const mentioned = new Map<string, Set<string>>();
  const mention = (r: Ref) => { (mentioned.get(r.repo) ?? mentioned.set(r.repo, new Set()).get(r.repo)!).add(r.path); };
  const adrs = readAdrs(model);
  const adrNums = new Set(adrs.map((a) => a.num));
  const adrMentioned = new Set<string>();
  const fnCache = new Map<string, string[] | null>();

  const fnsIn = (r: Ref): string[] | null => {
    const k = `${r.repo}:${r.path}`;
    if (!fnCache.has(k)) {
      const root = repoRoot(model, r.repo)!;
      fnCache.set(k, readCode(root, r.path, readFileSync(join(root, r.path), "utf8")).functions.map((f) => f.name));
    }
    return fnCache.get(k)!;
  };

  const checkRef = (where: string, s: string, defaultRepo = D, kind = "file") => {
    if (/^adr:/.test(s)) {
      const n = s.slice(4).padStart(4, "0");
      adrMentioned.add(n);
      if (!adrNums.has(n)) errors.push(`${where}: ADR ${n} does not exist in ${model.adrs_dir ?? "the ADR folder (set adrs_dir)"}`);
      return;
    }
    const r = parseRef(s, defaultRepo);
    if (!model.repos[r.repo]) { errors.push(`${where}: unknown repo "${r.repo}" in ${s}`); return; }
    mention(r);
    const root = repoRoot(model, r.repo);
    if (!root) { skipped.add(r.repo); return; }
    if (!filesOf(model, r.repo).includes(r.path) || !existsSync(join(root, r.path))) {
      errors.push(`${where}: ${kind} ${r.repo === D ? "" : r.repo + ":"}${r.path} is not in the repo (moved, renamed, deleted, or not tracked by git)`);
      return;
    }
    if (r.fn) {
      const names = fnsIn(r);
      if (!names?.includes(r.fn)) errors.push(`${where}: function ${r.fn}() is not in ${r.path} (renamed or removed?)`);
    }
  };

  for (const [k, r] of Object.entries(model.repos ?? {})) {
    if (r.remote_kind && !HOST_KINDS.includes(r.remote_kind)) errors.push(`repo ${k}: remote_kind "${r.remote_kind}" is not one of ${HOST_KINDS.join(", ")}`);
    const { remote, given, from } = remoteOf(model, k);
    // Only a URL the model states is an error; an origin fraktul cannot read just means no source links.
    if (from === "model" && !remote) errors.push(`repo ${k}: cannot tell how to link to ${redact(given!)}; set remote_kind (${HOST_KINDS.join(", ")})`);
  }

  if (!model.nodes[model.root]) errors.push(`root "${model.root}" is not a node`);
  const inDiagrams = new Set<string>([model.root]);
  const diagramIds = new Map<string, string[]>();
  for (const [id, n] of Object.entries(model.nodes)) {
    if (!ID.test(id)) errors.push(`node "${id}": ids are lowercase letters, digits and _ (they are Mermaid ids)`);
    if (!n.title) errors.push(`node ${id}: no title`);
    if (n.kind && !KINDS.includes(n.kind)) errors.push(`node ${id}: kind "${n.kind}" is not one of ${KINDS.join(", ")}`);
    if (n.anchors?.repo && !model.repos[n.anchors.repo]) errors.push(`node ${id}: unknown repo "${n.anchors.repo}"`);
    if (n.diagram) {
      const p = parseFlowchart(n.diagram);
      diagramIds.set(id, p.ids);
      if (!p.ids.length) errors.push(`node ${id}: diagram has no boxes`);
      for (const b of p.ids) if (model.nodes[b]) inDiagrams.add(b);
      for (const [box, a] of Object.entries(p.links)) {
        if (!p.ids.includes(box)) errors.push(`node ${id}: @link names box "${box}" that is not in the diagram`);
        checkRef(`node ${id} (@link ${box})`, a);
      }
      for (const b of p.expand) if (!model.nodes[b]?.diagram || !p.ids.includes(b)) errors.push(`node ${id}: @expand ${b} is not a block with its own diagram in this diagram`);
    }
    for (const a of anchorsOf(n, D)) {
      if (typeof a.ref === "string") { adrMentioned.add(a.ref); if (!adrNums.has(a.ref)) errors.push(`node ${id}: ADR ${a.ref} does not exist in ${model.adrs_dir ?? "the ADR folder (set adrs_dir)"}`); continue; }
      const s = `${a.ref.repo}:${a.ref.path}${a.ref.fn ? `#${a.ref.fn}` : ""}`;
      checkRef(`node ${id}`, s, a.ref.repo, a.kind === "functions" ? "function's file" : a.kind.replace(/s$/, ""));
      if (a.kind === "functions" && !a.ref.fn) errors.push(`node ${id}: functions entry ${a.ref.path} has no #name`);
    }
  }
  // block/inner references: the block must be a node with a diagram that has that box.
  for (const [id, n] of Object.entries(model.nodes)) {
    if (!n.diagram) continue;
    for (const r of parseFlowchart(n.diagram).refs) {
      if (!model.nodes[r.block]?.diagram) errors.push(`node ${id}: ${r.block}/${r.inner} points into "${r.block}", which has no diagram`);
      else if (!diagramIds.get(r.block)!.includes(r.inner)) errors.push(`node ${id}: ${r.block}/${r.inner}: no box "${r.inner}" in ${r.block}'s diagram`);
    }
  }
  const unreachable = Object.keys(model.nodes).filter((id) => !inDiagrams.has(id));

  // Requirements the model sets for itself (expect:).
  if (model.expect?.tours !== undefined && model.tours.length < model.expect.tours) errors.push(`expect: at least ${model.expect.tours} tours, found ${model.tours.length}`);
  if (model.expect?.depth && model.nodes[model.root]?.diagram) {
    const top = parseFlowchart(model.nodes[model.root].diagram!).ids.filter((b) => model.nodes[b]);
    for (const b of top) {
      const want = model.expect.depth[b] ?? model.expect.depth["*"];
      if (want !== undefined && modelDepth(model, b) < want) errors.push(`expect: ${b} drills ${modelDepth(model, b)} levels deep, needs ${want}`);
    }
  }

  // Tours.
  const stepIds = new Set<string>();
  for (const t of model.tours) for (const s of t.steps) { if (stepIds.has(s.id!)) errors.push(`tour ${t.id}: step id ${s.id} used twice`); stepIds.add(s.id!); }
  const tourIds = new Set(model.tours.map((t) => t.id));
  for (const t of model.tours) {
    if (!t.steps.length) errors.push(`tour ${t.id}: no steps`);
    for (const s of t.steps) {
      const where = `tour ${t.id} step ${s.id}`;
      const view = model.nodes[s.view];
      if (!view?.diagram) { errors.push(`${where}: view "${s.view}" is not a node with a diagram`); continue; }
      const ids = diagramIds.get(s.view)!;
      for (const f of s.focus ?? []) {
        const [b, inner] = f.split("/");
        if (!ids.includes(b)) errors.push(`${where}: focus "${f}" is not a box in ${s.view}`);
        else if (inner && !diagramIds.get(b)?.includes(inner)) errors.push(`${where}: focus "${f}": no box "${inner}" in ${b}`);
        else if (inner && !(s.expand ?? []).includes(b)) errors.push(`${where}: focus "${f}" needs "${b}" in expand`);
      }
      for (const m of (s.say ?? "").matchAll(/\[\[([^\]]*)\]\]/g)) for (const f of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
        const [b, inner] = f.split("/");
        if (!ids.includes(b) || (inner && !diagramIds.get(b)?.includes(inner))) errors.push(`${where}: narration cue [[${f}]] is not a box in ${s.view}`);
      }
      for (const e of s.expand ?? []) if (!ids.includes(e) || !model.nodes[e]?.diagram) errors.push(`${where}: expand "${e}" is not a block with a diagram in ${s.view}`);
      for (const to of [s.next, ...(s.branches ?? []).map((b) => b.to)].filter(Boolean) as string[]) {
        if (to.startsWith("tour:") ? !tourIds.has(to.slice(5)) : !stepIds.has(to)) errors.push(`${where}: goes to "${to}", which does not exist`);
      }
    }
  }

  // What the repo has that the model does not mention yet.
  const files: string[] = [];
  for (const c of model.coverage ?? []) {
    if (!repoRoot(model, c.repo)) { skipped.add(c.repo); continue; }
    const seen = mentioned.get(c.repo) ?? new Set();
    for (const f of filesOf(model, c.repo)) if (matches(f, c.include) && !matches(f, c.exclude ?? []) && !seen.has(f)) files.push(c.repo === D ? f : `${c.repo}:${f}`);
  }
  const unAdrs = adrs.filter((a) => !adrMentioned.has(a.num)).map((a) => `${a.num} ${a.title}`);
  // What the running system says (fraktul traces), against what the model draws.
  const observed = loadObserved(model);
  return {
    ...(observed ? { traces: compareTraces(model, observed) } : {}),
    errors,
    unmentioned: { files, adrs: unAdrs },
    skipped: [...skipped],
    unreachable,
    stats: { nodes: Object.keys(model.nodes).length, diagrams: diagramIds.size, tours: model.tours.length, steps: stepIds.size, adrs: adrs.length },
  };
}

/** How deep you can drill from a node through model diagrams (code levels below a node's files are not counted). */
export function modelDepth(model: Model, id: string, seen = new Set<string>()): number {
  const n = model.nodes[id];
  if (!n || seen.has(id)) return 0;
  const hasCode = (n.anchors?.files?.length ?? 0) + (n.anchors?.functions?.length ?? 0) > 0;
  if (!n.diagram) return hasCode ? 1 : 0;
  seen.add(id);
  const p = parseFlowchart(n.diagram);
  const kids = p.ids.filter((b) => model.nodes[b] && b !== id);
  // A box with `@link` opens a file or function, one more level down.
  const linked = Object.keys(p.links).length || hasCode ? 1 : 0;
  return 1 + Math.max(linked, ...kids.map((k) => modelDepth(model, k, new Set(seen))));
}
