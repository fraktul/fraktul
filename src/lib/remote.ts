// Where a repo lives on the web, so a deployed map can link every file and function to its source. Local paths only
// matter while building; the page carries these links instead. Links are pinned to the commit that was read.

import { execFileSync } from "node:child_process";

export type HostKind = "github" | "gitlab" | "bitbucket" | "azure" | "gitea";
/** A repo's web home: `web` is the browsable repo URL with no trailing slash, `label` names the host for buttons. */
export type Remote = { kind: HostKind; web: string; label: string };

const LABELS: Record<HostKind, string> = { github: "GitHub", gitlab: "GitLab", bitbucket: "Bitbucket", azure: "Azure DevOps", gitea: "Gitea" };
export const HOST_KINDS = Object.keys(LABELS) as HostKind[];

/**
 * Turns a clone URL or web URL into the repo's web home. Accepts https, ssh:// and scp-style (`git@host:owner/repo.git`)
 * forms. Any username, password or token in the URL is dropped, so a credential in `origin` never reaches the page.
 * `kind` names the host type for self-hosted servers whose name does not say it. Null when the URL cannot be read, or
 * the host type is unknown and not given.
 */
export function parseRemote(url: string, kind?: HostKind): Remote | null {
  let s = url.trim();
  if (!s) return null;
  // scp-style: [user@]host:path (no scheme). Azure's is git@ssh.dev.azure.com:v3/org/project/repo.
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(s);
  let host: string, path: string;
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    host = scp[1];
    path = scp[2];
  } else {
    let u: URL;
    try { u = new URL(s); } catch { return null; }
    if (!["http:", "https:", "ssh:", "git:"].includes(u.protocol)) return null;
    host = u.hostname;
    // An https URL keeps its port (self-hosted servers); ssh ports are not web ports.
    if (u.protocol === "https:" || u.protocol === "http:") host = u.host;
    path = u.pathname;
  }
  path = path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "");
  if (!path) return null;
  const h = host.toLowerCase();

  // Azure DevOps has its own shapes for ssh and web URLs; normalise to https://dev.azure.com/org/project/_git/repo.
  if (kind === "azure" || h === "dev.azure.com" || h === "ssh.dev.azure.com" || h.endsWith(".visualstudio.com")) {
    const parts = path.split("/").map(decodeURIComponent);
    let org: string | undefined, project: string | undefined, repo: string | undefined;
    if (h === "ssh.dev.azure.com" && parts[0] === "v3") [, org, project, repo] = parts;
    else if (h.endsWith(".visualstudio.com")) {
      org = h.split(".")[0];
      const g = parts.indexOf("_git");
      if (g > 0) { project = parts[g - 1]; repo = parts[g + 1]; }
      else if (parts[0] === "v3" || parts[0] === "DefaultCollection") { project = parts.at(-2); repo = parts.at(-1); }
    } else {
      const g = parts.indexOf("_git");
      if (g >= 2) { org = parts[0]; project = parts[g - 1]; repo = parts[g + 1]; }
    }
    if (!org || !project || !repo) return null;
    const enc = (x: string) => encodeURIComponent(x);
    return { kind: "azure", web: `https://dev.azure.com/${enc(org)}/${enc(project)}/_git/${enc(repo)}`, label: LABELS.azure };
  }

  const guess: HostKind | undefined = kind ?? (
    h === "github.com" || h.endsWith(".github.com") || h.startsWith("github.") ? "github" :
    h === "gitlab.com" || h.startsWith("gitlab.") ? "gitlab" :
    h === "bitbucket.org" ? "bitbucket" :
    h === "codeberg.org" || h.startsWith("gitea.") || h.startsWith("forgejo.") ? "gitea" : undefined);
  if (!guess) return null;
  // GitLab web URLs can carry /-/tree/... after the project path; keep only the project.
  if (guess === "gitlab") path = path.split("/-/")[0];
  // GitHub, Bitbucket and Gitea repos are owner/repo; drop anything after (a pasted /tree/main link).
  if (guess !== "gitlab") path = path.split("/").slice(0, 2).join("/");
  if (path.split("/").length < 2) return null;
  return { kind: guess, web: `https://${h}/${path}`, label: LABELS[guess] };
}

const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/**
 * Link to a file (and optionally lines `from`–`to`) at commit or branch `ref` in the host's own URL format.
 * With no ref, the link follows the default branch.
 */
export function sourceUrl(r: Remote, path: string, ref: string | null, from?: number, to?: number): string {
  const p = encPath(path.replace(/^\/+/, ""));
  const end = to ?? from;
  const at = ref ?? "HEAD";
  switch (r.kind) {
    case "github": return `${r.web}/blob/${at}/${p}${from ? `#L${from}${end !== from ? `-L${end}` : ""}` : ""}`;
    case "gitlab": return `${r.web}/-/blob/${at}/${p}${from ? `#L${from}${end !== from ? `-${end}` : ""}` : ""}`;
    case "bitbucket": return `${r.web}/src/${at}/${p}${from ? `#lines-${from}${end !== from ? `:${end}` : ""}` : ""}`;
    case "gitea": return `${r.web}/src/${ref ? `commit/${ref}` : "branch/HEAD"}/${p}${from ? `#L${from}${end !== from ? `-L${end}` : ""}` : ""}`;
    case "azure": {
      const q = new URLSearchParams({ path: `/${path.replace(/^\/+/, "")}` });
      if (ref) q.set("version", `GC${ref}`);
      // Azure selects from (line, column) up to (lineEnd, lineEndColumn): column 1 of the line after `to` covers all of it.
      if (from) { q.set("line", String(from)); q.set("lineEnd", String((end ?? from) + 1)); q.set("lineStartColumn", "1"); q.set("lineEndColumn", "1"); q.set("lineStyle", "plain"); q.set("_a", "contents"); }
      return `${r.web}?${q}`;
    }
  }
}

/** A URL safe to print: any username, password or token before the host is removed. */
export function redact(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]*@/i, "$1").replace(/^[^@/:\s]+@(?=[^:/\s]+:)/, "");
}

/** The checkout's `origin` URL, or null when there is none. */
export function originOf(root: string): string | null {
  try { return execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch { return null; }
}
