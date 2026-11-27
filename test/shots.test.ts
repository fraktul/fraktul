import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSite } from "../src/lib/build.ts";
import { loadModel } from "../src/lib/model.ts";
import { SHOTS } from "../src/lib/shots.ts";

test("site screenshots: every deep link leads to a view, a box and a tour stop that exist in the example map", async () => {
  const site = await buildSite(loadModel());
  for (const s of SHOTS) {
    const [path, query = ""] = s.link.slice(1).split("?");
    const [slug, box] = path.split("/");
    const key = decodeURIComponent(slug).includes(":") ? decodeURIComponent(slug) : `node:${slug.replace(/-/g, "_")}`;
    assert.ok(site.diagrams[key], `${s.id}: no level ${key}`);
    if (box) assert.ok(site.diagrams[key].ids.includes(box), `${s.id}: no box ${box} on ${key}`);
    const p = new URLSearchParams(query);
    if (p.get("tour")) { const t = site.tours.find((x) => x.id === p.get("tour")); assert.ok(t?.steps[Number(p.get("step")) - 1], `${s.id}: no such tour stop`); }
  }
});

test("big files: fraktul's own map page is drawn as groups, each with its own level", async () => {
  const site = await buildSite(loadModel());
  const file = "file:fraktul:src/components/fraktul-map/fraktul-map.ts";
  const parts = Object.values(site.parts).filter((p) => p.file === file);
  assert.ok(parts.length >= 8, "the file's section headings become groups");
  assert.equal(new Set(parts.flatMap((p) => p.functions)).size, site.files[file].functions.filter((n) => site.fns[`fn:fraktul:src/components/fraktul-map/fraktul-map.ts#${n}`]).length, "every function is in exactly one group");
  for (const p of parts) assert.ok(site.diagrams[p.key], `${p.title} has a diagram`);
  assert.ok(site.diagrams[file].lines.length < 80, "the overview stays small");
});
