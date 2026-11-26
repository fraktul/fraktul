// node --test test/*.test.ts   (uses example/model.yaml: fraktul's own map)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { checkModel, modelDepth } from "../src/lib/check.ts";
import { parseFlowchart, plain } from "../src/lib/mermaid.ts";
import { loadModel } from "../src/lib/model.ts";
import { readCode } from "../src/lib/code.ts";

const EXAMPLE = join(import.meta.dirname, "..", "example", "model.yaml");

test("Mermaid parser: ids, shapes, labelled edges, block/inner and directives", () => {
  const p = parseFlowchart(`flowchart LR
    a["Sort (code)"]:::code --> b{"Agree?"}
    b -- "no, ask" --> c(["Coder"])
    b -->|yes| other/inner
    subgraph S1["Group"]
      d[(Data)]
    end
    class a,b model
    %% @link d eval/calc.ts#fractionBlocks
    %% @expand other
    click a call foo()`);
  assert.deepEqual(p.ids, ["a", "b", "c", "other", "S1", "d"]);
  assert.deepEqual(p.refs, [{ block: "other", inner: "inner" }]);
  assert.deepEqual(p.links, { d: "eval/calc.ts#fractionBlocks" });
  assert.deepEqual(p.expand, ["other"]);
  assert.ok(!plain(p).includes("click"), "click lines are dropped");
  assert.ok(plain(p).includes('b -- "no, ask" --> c(["Coder"])'), "labelled edge kept as written");
});

test("code reader: functions with generics, arrow functions, nested helpers", () => {
  const src = ["export function seal<P extends Payload<E>>(p: P): P {", "  return p;", "}", "export const twice = (x: number) => x * 2;",
    "export async function outer() {", "  function inner() { return twice(1); }", "  return inner();", "}"].join("\n");
  const cf = readCode("/", "x.ts", src);
  assert.deepEqual(cf.functions.map((f) => [f.name, f.line, f.end]), [["seal", 1, 3], ["twice", 4, 4], ["outer", 5, 8], ["inner", 6, 6]]);
});

test("the example model (fraktul itself) checks clean and drills down", () => {
  const m = loadModel(EXAMPLE);
  assert.deepEqual(checkModel(m).errors, []);
  assert.ok(modelDepth(m, "fraktul") >= 3);
});

test("the check fails on a moved file, a renamed function, a bad link, cue, focus and next step", () => {
  const raw = parse(readFileSync(EXAMPLE, "utf8"));
  raw.project_root = join(import.meta.dirname, "..");
  raw.nodes.check.anchors.files = ["scripts/moved.ts"];
  raw.nodes.check.anchors.functions = ["src/lib/check.ts#checkModelRenamed"];
  raw.nodes.build.diagram += "\n        %% @link read src/nowhere.ts";
  raw.tours[0].steps[0].focus = ["no_such_box"];
  raw.tours[0].steps[0].next = "no-such-step";
  raw.tours[0].steps[1].say = "Hello. [[ghost]] Boo.";
  const dir = mkdtempSync(join(tmpdir(), "fraktul-"));
  writeFileSync(join(dir, "model.yaml"), stringify(raw));
  const r = checkModel(loadModel(join(dir, "model.yaml")));
  const has = (s: string) => assert.ok(r.errors.some((e) => e.includes(s)), `expected an error mentioning ${s}:\n${r.errors.join("\n")}`);
  for (const s of ["scripts/moved.ts", "checkModelRenamed", "src/nowhere.ts", "no_such_box", "no-such-step", "[[ghost]]"]) has(s);
});
