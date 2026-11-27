import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { checkModel } from "../src/lib/check.ts";
import { starterBlocks, starterModel } from "../src/lib/init.ts";
import { loadModel } from "../src/lib/model.ts";

const FILES = ["README.md", "src/api/orders.ts", "src/api/pay.ts", "src/api/pay.test.ts", "src/web/page.tsx", "src/2fa/otp.ts", "scripts/seed.js", "node_modules/x/index.js", "src/api/node_modules/y.js"];

test("init: one block per big folder, looking inside a folder that holds nearly everything", () => {
  const blocks = starterBlocks(FILES);
  assert.deepEqual(blocks.map((b) => b.id), ["scripts", "src_2fa", "src_api", "src_web"]);
  assert.deepEqual(blocks.find((b) => b.id === "src_api")!.files, ["src/api/orders.ts", "src/api/pay.ts"], "tests and node_modules stay out");
  assert.deepEqual(starterBlocks(["a/x.ts", "b/y.ts", "b/z.ts"]).map((b) => b.id), ["a", "b"]);
});

test("init: the starter model passes the check as written, with and without code", () => {
  for (const files of [FILES.filter((f) => !f.includes("node_modules")), ["README.md"]]) {
    const dir = mkdtempSync(join(tmpdir(), "fraktul-init-"));
    for (const f of files) { mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), "export function a() { return 1; }\n"); }
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd: dir, stdio: "ignore" });
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "init");
    mkdirSync(join(dir, "docs/arch"), { recursive: true });
    writeFileSync(join(dir, "docs/arch/model.yaml"), starterModel("my-shop", files));
    const model = loadModel(join(dir, "docs/arch/model.yaml"));
    assert.equal(model.title, "My shop system map");
    assert.deepEqual(checkModel(model).errors, []);
  }
});
