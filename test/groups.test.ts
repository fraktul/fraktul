import assert from "node:assert/strict";
import { test } from "node:test";
import { groupFile, sectionsOf, type GroupFn } from "../src/lib/groups.ts";

const fn = (name: string, line: number, calls: string[] = []): GroupFn => ({ key: name, name, line, exported: false, calls, calledBy: [] });
const wire = (fns: GroupFn[]) => { for (const f of fns) for (const c of f.calls) fns.find((x) => x.key === c)!.calledBy.push(f.key); return fns; };

test("groups: section headings in source are found, in any comment style", () => {
  const s = sectionsOf(["// ───────────── state ─────────────", "let x = 1;", "# ==== Reading files ====", "  // ---- indented: not a heading ----", "// MARK: - Drawing", "// just a comment", "//#region Peek: hover a box (mouse only)", "// ----------------"]);
  assert.deepEqual(s.map((x) => x.title), ["State", "Reading files", "Drawing", "Peek"]);
  assert.deepEqual(s.map((x) => x.line), [1, 3, 5, 7]);
});

test("groups: a file with headings is grouped by them, in file order", () => {
  const fns = wire([fn("a", 2), fn("b", 3, ["a"]), fn("c", 12, ["a"]), fn("d", 13), fn("e", 22, ["c"]), fn("top", 1)]);
  const { groups } = groupFile(fns, [{ title: "Read", line: 1 }, { title: "Check", line: 10 }, { title: "Draw", line: 20 }]);
  assert.deepEqual(groups.map((g) => [g.title, g.fns]), [["Top of the file", ["top"]], ["Read", ["a", "b"]], ["Check", ["c", "d"]], ["Draw", ["e"]]]);
});

test("groups: without headings, each entry point owns what only it reaches; widely used helpers stand apart", () => {
  const callers = Array.from({ length: 6 }, (_, i) => fn(`leaf${i}`, 30 + i, ["log"]));
  const fns = wire([fn("build", 1, ["read", "draw", "log"]), fn("read", 2, ["parse"]), fn("parse", 3), fn("draw", 4, ["shared"]), fn("check", 10, ["verify", "shared"]), fn("verify", 11), fn("shared", 20), fn("log", 25), ...callers]);
  const { groups, helpers } = groupFile(fns, []);
  assert.deepEqual([...helpers], ["log"]);
  const by = Object.fromEntries(groups.map((g) => [g.title, g.fns]));
  assert.deepEqual(by["build() and what it calls"], ["build", "read", "parse", "draw"]);
  assert.deepEqual(by["check() and what it calls"], ["check", "verify"]);
  assert.deepEqual(by["Shared by several flows"], ["shared"]);
  assert.deepEqual(by["Helpers used everywhere"], ["log"]);
  assert.equal(by["On their own"].length, 6);
  assert.equal(new Set(groups.flatMap((g) => g.fns)).size, fns.length, "every function is in exactly one group");
});
