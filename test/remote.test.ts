// Source links for every host: reading clone URLs, dropping credentials, and each host's line-link format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRemote, redact, sourceUrl } from "../src/lib/remote.ts";

test("remote: clone and web URLs on each host become the repo's web home", () => {
  const web = (u: string, k?: any) => parseRemote(u, k)?.web ?? null;
  assert.equal(web("git@github.com:rinsesoft/fraktul.git"), "https://github.com/rinsesoft/fraktul");
  assert.equal(web("https://github.com/rinsesoft/fraktul"), "https://github.com/rinsesoft/fraktul");
  assert.equal(web("ssh://git@github.com/rinsesoft/fraktul.git"), "https://github.com/rinsesoft/fraktul");
  assert.equal(web("https://github.com/rinsesoft/fraktul/tree/main/src"), "https://github.com/rinsesoft/fraktul");
  assert.equal(web("git@gitlab.com:acme/platform/billing.git"), "https://gitlab.com/acme/platform/billing");
  assert.equal(web("https://gitlab.com/acme/platform/billing/-/tree/main"), "https://gitlab.com/acme/platform/billing");
  assert.equal(web("git@bitbucket.org:acme/billing.git"), "https://bitbucket.org/acme/billing");
  assert.equal(web("https://codeberg.org/acme/billing.git"), "https://codeberg.org/acme/billing");
  assert.equal(web("git@ssh.dev.azure.com:v3/acme/Billing%20Team/billing"), "https://dev.azure.com/acme/Billing%20Team/_git/billing");
  assert.equal(web("https://acme@dev.azure.com/acme/Billing/_git/billing"), "https://dev.azure.com/acme/Billing/_git/billing");
  assert.equal(web("https://acme.visualstudio.com/Billing/_git/billing"), "https://dev.azure.com/acme/Billing/_git/billing");
  assert.equal(web("https://git.acme.internal:8443/team/billing.git"), null, "unknown self-hosted server needs remote_kind");
  assert.equal(web("https://git.acme.internal:8443/team/billing.git", "gitlab"), "https://git.acme.internal:8443/team/billing");
  assert.equal(web("/home/me/src/billing"), null);
  assert.equal(web(""), null);
});

test("remote: credentials in a URL never reach the page", () => {
  const r = parseRemote("https://x-access-token:ghp_secret@github.com/acme/billing.git")!;
  assert.equal(r.web, "https://github.com/acme/billing");
  assert.ok(!JSON.stringify(r).includes("secret"));
  assert.equal(redact("https://user:tok@gitlab.com/a/b.git"), "https://gitlab.com/a/b.git");
  assert.equal(redact("git@github.com:a/b.git"), "github.com:a/b.git");
});

test("remote: file and line links in each host's format, pinned to the commit", () => {
  const sha = "c80927df336839d80a10fead4c5e923f26923177";
  const at = (u: string, k?: any) => (path: string, from?: number, to?: number, ref: string | null = sha) => sourceUrl(parseRemote(u, k)!, path, ref, from, to);
  const gh = at("git@github.com:acme/billing.git");
  assert.equal(gh("src/a.ts"), `https://github.com/acme/billing/blob/${sha}/src/a.ts`);
  assert.equal(gh("src/a.ts", 10, 20), `https://github.com/acme/billing/blob/${sha}/src/a.ts#L10-L20`);
  assert.equal(gh("src/a.ts", 7, 7), `https://github.com/acme/billing/blob/${sha}/src/a.ts#L7`);
  assert.equal(gh("src/a.ts", undefined, undefined, null), "https://github.com/acme/billing/blob/HEAD/src/a.ts");
  assert.equal(gh("docs/my notes.md"), `https://github.com/acme/billing/blob/${sha}/docs/my%20notes.md`);
  assert.equal(at("https://gitlab.com/acme/billing")("src/a.ts", 10, 20), `https://gitlab.com/acme/billing/-/blob/${sha}/src/a.ts#L10-20`);
  assert.equal(at("https://bitbucket.org/acme/billing")("src/a.ts", 10, 20), `https://bitbucket.org/acme/billing/src/${sha}/src/a.ts#lines-10:20`);
  assert.equal(at("https://codeberg.org/acme/billing")("src/a.ts", 10, 20), `https://codeberg.org/acme/billing/src/commit/${sha}/src/a.ts#L10-L20`);
  const az = new URL(at("https://dev.azure.com/acme/Billing/_git/billing")("src/a.ts", 10, 20));
  assert.equal(az.origin + az.pathname, "https://dev.azure.com/acme/Billing/_git/billing");
  assert.equal(az.searchParams.get("path"), "/src/a.ts");
  assert.equal(az.searchParams.get("version"), `GC${sha}`);
  assert.equal(az.searchParams.get("line"), "10");
  assert.equal(az.searchParams.get("lineEnd"), "21");
});

test("remote: the check reports a stated remote it cannot link to, without printing credentials", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { stringify } = await import("yaml");
  const { loadModel } = await import("../src/lib/model.ts");
  const { checkModel } = await import("../src/lib/check.ts");
  const dir = mkdtempSync(join(tmpdir(), "fraktul-remote-"));
  writeFileSync(join(dir, "model.yaml"), stringify({
    version: 1, root: "sys",
    repos: {
      odd: { path: "~/nowhere-odd", remote: "https://me:hunter2@git.acme.internal/team/odd.git" },
      named: { path: "~/nowhere-named", remote: "https://git.acme.internal/team/named.git", remote_kind: "gitlab" },
      plain: { path: "~/nowhere-plain", github: "acme/plain" },
    },
    nodes: { sys: { title: "System", diagram: "flowchart LR\n  a[\"A\"]" } },
    tours: [],
  }));
  const errors = checkModel(loadModel(join(dir, "model.yaml"))).errors.filter((e) => e.startsWith("repo "));
  assert.equal(errors.length, 1, errors.join("\n"));
  assert.ok(errors[0].includes("repo odd") && errors[0].includes("remote_kind"));
  assert.ok(!errors[0].includes("hunter2"), "credentials are not printed");
});
