import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSite } from "../src/lib/build.ts";
import { loadModel } from "../src/lib/model.ts";
import { SHOTS } from "../src/lib/shots.ts";
import { compareTraces, loadObserved } from "../src/lib/traces.ts";

test("site screenshots: every deep link leads to a view, a box and a tour stop that exist in the example map", async () => {
  const maps = { "/map": await buildSite(loadModel()), "/shop/": await buildSite(loadModel("example/shop/model.yaml")) };
  for (const s of SHOTS) {
    const site = maps[(s.map ?? "/map") as keyof typeof maps];
    const [path, query = ""] = s.link.slice(1).split("?");
    const [slug, box] = path.split("/");
    const key = decodeURIComponent(slug).includes(":") ? decodeURIComponent(slug) : `node:${slug.replace(/-/g, "_")}`;
    assert.ok(site.diagrams[key], `${s.id}: no level ${key}`);
    if (box) assert.ok(site.diagrams[key].ids.includes(box), `${s.id}: no box ${box} on ${key}`);
    const p = new URLSearchParams(query);
    if (p.get("tour")) { const t = site.tours.find((x) => x.id === p.get("tour")); assert.ok(t?.steps[Number(p.get("step")) - 1], `${s.id}: no such tour stop`); }
  }
});

test("the demo shop: its model matches its traces, and the links the site makes into it exist", async () => {
  const model = loadModel("example/shop/model.yaml");
  const r = compareTraces(model, loadObserved(model)!);
  assert.deepEqual(r.undrawn, [], "every call the traces saw is drawn");
  assert.deepEqual(r.unmapped, [], "every service in the traces is on the map");
  const site = await buildSite(model);
  for (const id of ["shop", "delivery", "checkout"]) assert.ok(site.diagrams[`node:${id}`], `level ${id}`);
  assert.deepEqual(site.tours.map((t) => t.id), ["the-shop-in-two-minutes", "follow-one-order", "how-a-page-is-built", "keeping-the-shop-running"]);
  // Every stop of every tour is narrated, and the audio for it is in the repo.
  for (const t of site.tours) for (const s of t.steps) assert.ok(site.voice[t.id]?.steps[s.id!]?.file, `${t.id} ${s.id} has no narration: run fraktul voice on example/shop/model.yaml`);
  assert.ok(site.live.blocks["traces:checkout"].list!.length >= 8, "checkout's panel lists its callers and callees");
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
