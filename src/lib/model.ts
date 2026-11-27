// A fraktul model (a YAML file in the project it describes): its types, where each repo lives, and how anchors are
// written. Paths in the model are relative to the project root: `project_root` (relative to the model file), else the
// git checkout that holds the model.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { originOf, parseRemote, type HostKind, type Remote } from "./remote.ts";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
/** The fraktul checkout itself. */
export const FRAKTUL = resolve(here, "../..");
/** The model to build: FRAKTUL_MODEL (set by bin/fraktul.ts), else the example in this repo. */
export const MODEL_PATH = resolve(process.env.FRAKTUL_MODEL ?? join(FRAKTUL, "example/model.yaml"));

export type Status = "built" | "prototype" | "planned" | "external" | "proposed";
/**
 * What a block is. The four that name a level of the picture, from 30,000 feet down: `system` (the whole thing, or one
 * of several systems), `service` (something deployed and running), `feature` (something the product does, inside or
 * across services), then files and functions, which fraktul reads from the code. `district` is an older word for
 * system; the rest say what kind of thing a box stands for.
 */
export type Kind = "system" | "district" | "service" | "feature" | "component" | "module" | "data" | "person" | "repo" | "doc" | "step";
export const KINDS: Kind[] = ["system", "district", "service", "feature", "component", "module", "data", "person", "repo", "doc", "step"];

export type Anchors = {
  repo?: string;
  files?: string[];
  functions?: string[];
  data?: string[];
  docs?: string[];
  adrs?: string[];
};

export type ModelNode = {
  title: string;
  kind?: Kind;
  status?: Status;
  summary?: string;
  detail?: string;
  diagram?: string;
  live?: string[];
  /** The name (or names) this block goes by in traces: OpenTelemetry's `service.name`. See src/lib/traces.ts. */
  service?: string | string[];
  anchors?: Anchors;
  facts?: Record<string, string | number>;
};

export type TourStep = {
  id?: string;
  view: string;
  focus?: string[];
  expand?: string[];
  title: string;
  text: string;
  next?: string;
  branches?: { label: string; to: string }[];
  /** Spoken narration (fraktul voice): says more than `text`; `[[box, other]]` moves the highlight as it speaks. */
  say?: string;
};

export type Tour = { id: string; title: string; summary: string; steps: TourStep[]; voice?: Voice };
export type RepoConf = {
  path: string;
  /** Shorthand for `remote: https://github.com/<owner/repo>`. */
  github?: string;
  /** Where the repo lives on the web (clone or web URL, any host). Default: the checkout's `origin`. */
  remote?: string;
  /** Host type for a self-hosted server whose name does not say it. */
  remote_kind?: HostKind;
  /** The remote needs access most readers may not have: the map marks its links with a lock. */
  remote_private?: boolean;
  title?: string;
  include?: string[];
  private?: boolean;
};
export type Voice = { engine?: "kokoro"; model?: string; voice?: string; speed?: number };
export type Model = {
  version: number;
  root: string;
  title?: string;
  brand?: string;
  /** Where the logo in the map's top bar goes (a URL); default: the top of the map. */
  home?: string;
  /** Relative to the model file; default: the git checkout that holds the model. */
  project_root?: string;
  /** Repo key for anchors that name no repo; default: the repo whose path is ".". */
  default_repo?: string;
  /** Folder of Markdown ADRs (NNNN-title.md with a "- Status:" line), relative to the project root. */
  adrs_dir?: string;
  /** A module (relative to the model file) whose default export returns live fact blocks: see src/lib/live.ts. */
  live_module?: string;
  /** The summary `fraktul traces` wrote, relative to the model file. Default: traces.json beside the model, if any. */
  traces?: string;
  voice?: Voice;
  /** Requirements the check enforces: drill-down depth per top-level block ("*" for the rest), tours. */
  expect?: { depth?: Record<string, number>; tours?: number };
  /** Set by loadModel. */
  file: string;
  dir: string;
  project: string;
  repos: Record<string, RepoConf>;
  coverage?: { repo: string; include: string[]; exclude?: string[] }[];
  nodes: Record<string, ModelNode>;
  tours: Tour[];
};

export function loadModel(path = MODEL_PATH): Model {
  const m = parse(readFileSync(path, "utf8")) as Model;
  m.file = resolve(path);
  m.dir = dirname(m.file);
  m.project = m.project_root ? resolve(m.dir, m.project_root) : gitTop(m.dir) ?? m.dir;
  m.default_repo ??= Object.entries(m.repos ?? {}).find(([, r]) => r.path === ".")?.[0] ?? "main";
  m.tours ??= [];
  for (const t of m.tours) t.steps.forEach((s, i) => (s.id ??= `${t.id}-${i + 1}`));
  return m;
}

function gitTop(dir: string): string | null {
  try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}

/** Absolute folder of a repo, or null when it is not checked out on this machine (CI usually has only the project). */
export function repoRoot(m: Model, repo: string): string | null {
  const conf = m.repos[repo];
  if (!conf) return null;
  const p = conf.path.startsWith("~/") ? join(homedir(), conf.path.slice(2)) : resolve(m.project, conf.path);
  const env = process.env[`FRAKTUL_REPO_${repo.replace(/\W/g, "_").toUpperCase()}`];
  const root = env ?? p;
  return existsSync(root) ? root : null;
}

/** A file anchor: `path`, `repo:path`, with an optional `#function`. */
export type Ref = { repo: string; path: string; fn?: string };
export function parseRef(s: string, defaultRepo: string): Ref {
  const [lhs, fn] = s.split("#");
  const m = lhs.match(/^([a-z][\w-]*):(.+)$/);
  return { repo: m ? m[1] : defaultRepo, path: m ? m[2] : lhs, ...(fn ? { fn } : {}) };
}
export const fileKey = (r: Ref) => `file:${r.repo}:${r.path}`;
export const fnKey = (r: Ref) => `fn:${r.repo}:${r.path}#${r.fn}`;

function globRe(g: string): RegExp {
  const s = g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${s}$`);
}
export const matches = (path: string, globs: string[]) => globs.some((g) => globRe(g).test(path));

const tracked = new Map<string, string[]>();
/**
 * Files the explorer may read in a repo: git-tracked files only (so gitignored, licensed or sensitive data never enters
 * the site), narrowed by the repo's `include` globs. A folder that is not a git repo is read only through `include`.
 */
export function filesOf(m: Model, repo: string): string[] {
  if (tracked.has(repo)) return tracked.get(repo)!;
  const root = repoRoot(m, repo);
  let files: string[] = [];
  if (root) {
    try {
      files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
      const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" }).trim();
      // Through a symlink (or macOS's /var), `root` and git's own path differ in spelling: compare the real paths.
      const sub = relative(realpathSync(top), realpathSync(root));
      if (sub) files = files.filter((f) => f.startsWith(`${sub}/`)).map((f) => f.slice(sub.length + 1));
    } catch {
      // Not a git repo: list only the folders the include globs name, never the rest.
      const inc = m.repos[repo].include ?? [];
      const tops = [...new Set(inc.map((g) => g.split("/")[0]).filter((t) => !t.includes("*")))];
      files = tops.flatMap((t) => (existsSync(join(root, t)) && statSync(join(root, t)).isDirectory() ? walk(root, join(root, t)) : existsSync(join(root, t)) ? [t] : []));
    }
    const inc = m.repos[repo].include;
    if (inc) files = files.filter((f) => matches(f, inc));
  }
  tracked.set(repo, files);
  return files;
}

function walk(root: string, dir: string, depth = 0): string[] {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(root, p, depth + 1));
    else out.push(relative(root, p));
  }
  return out;
}

/**
 * A repo's web home for source links: `remote`, else `github`, else the checkout's `origin`. `given` is the URL the
 * model or the checkout supplied, so the check can report one it cannot read.
 */
export function remoteOf(m: Model, repo: string): { remote: Remote | null; given: string | null; from: "model" | "origin" | null } {
  const conf = m.repos[repo];
  if (!conf) return { remote: null, given: null, from: null };
  const stated = conf.remote ?? (conf.github ? `https://github.com/${conf.github}` : null);
  if (stated) return { remote: parseRemote(stated, conf.remote_kind), given: stated, from: "model" };
  const root = repoRoot(m, repo);
  const origin = root ? originOf(root) : null;
  return { remote: origin ? parseRemote(origin, conf.remote_kind) : null, given: origin, from: origin ? "origin" : null };
}

export function headOf(m: Model, repo: string): string | null {
  const root = repoRoot(m, repo);
  if (!root) return null;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}

/** Every anchor string a node carries, with its kind. */
export function anchorsOf(n: ModelNode, defaultRepo: string): { kind: keyof Anchors; ref: Ref | string }[] {
  const a = n.anchors ?? {};
  const repo = a.repo ?? defaultRepo;
  const out: { kind: keyof Anchors; ref: Ref | string }[] = [];
  for (const k of ["files", "functions", "data", "docs"] as const) for (const s of a[k] ?? []) out.push({ kind: k, ref: parseRef(s, repo) });
  for (const s of a.adrs ?? []) out.push({ kind: "adrs", ref: String(s).padStart(4, "0") });
  return out;
}
