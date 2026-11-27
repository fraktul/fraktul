// node scripts/check-model.ts [--strict] [--json]
// Fails (exit 1) when docs/arch/model.yaml points at a file, function, ADR, diagram box or tour step that does not
// exist. Lists files and ADRs in the repo the model does not mention yet, and calls and services the traces show that
// the model does not draw; --strict fails on those too.

import { checkModel, modelDepth } from "../src/lib/check.ts";
import { loadModel, MODEL_PATH } from "../src/lib/model.ts";
import { parseFlowchart } from "../src/lib/mermaid.ts";

const strict = process.argv.includes("--strict");
const model = loadModel();
const r = checkModel(model);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(r, null, 2));
} else {
  console.log(`Model: ${MODEL_PATH}`);
  console.log(`${r.stats.nodes} nodes, ${r.stats.diagrams} diagrams, ${r.stats.tours} tours (${r.stats.steps} steps), ${r.stats.adrs} ADRs${model.adrs_dir ? ` in ${model.adrs_dir}` : ""}`);
  const root = model.nodes[model.root].diagram ? parseFlowchart(model.nodes[model.root].diagram!).ids.filter((b) => model.nodes[b]) : [];
  console.log(`Drill-down depth from the top (model levels; code levels come on top): ${root.map((d) => `${d} ${modelDepth(model, d)}`).join(", ")}`);
  if (r.skipped.length) console.log(`Not checked (repo not on this machine): ${r.skipped.join(", ")}`);
  if (r.unreachable.length) console.log(`\nNodes no diagram shows (reachable only from tours or panels): ${r.unreachable.join(", ")}`);
  if (r.unmentioned.files.length || r.unmentioned.adrs.length) {
    console.log(`\nIn the repo but not in the model yet (${r.unmentioned.files.length} files, ${r.unmentioned.adrs.length} ADRs):`);
    for (const f of r.unmentioned.files) console.log(`  file  ${f}`);
    for (const a of r.unmentioned.adrs) console.log(`  ADR   ${a}`);
  }
  if (r.traces) {
    const t = r.traces, title = (id: string) => model.nodes[id]?.title ?? id;
    console.log(`\nAgainst the traces: ${t.undrawn.length} call${t.undrawn.length === 1 ? "" : "s"} not drawn, ${t.unmapped.length} service${t.unmapped.length === 1 ? "" : "s"} not on the map`);
    for (const u of t.undrawn) console.log(`  call     ${title(u.from)} → ${title(u.to)} happens (${u.calls} calls in the traces) but no diagram draws ${u.from} --> ${u.to}`);
    for (const s of t.unmapped) console.log(`  service  ${s} is in the traces; no block says service: ${s}`);
    for (const u of t.unseen) console.log(`  unseen   ${u.from} --> ${u.to} is drawn, but the traces never showed that call`);
    for (const u of t.unknown) console.log(`  unknown  node ${u.node} says service: ${u.service}, which is not in the traces`);
  }
  if (r.errors.length) {
    console.log(`\n${r.errors.length} broken reference${r.errors.length === 1 ? "" : "s"}:`);
    for (const e of r.errors) console.log(`  ✗ ${e}`);
  } else console.log("\nAll references resolve.");
}
const drift = (r.traces?.undrawn.length ?? 0) + (r.traces?.unmapped.length ?? 0);
const fail = r.errors.length > 0 || (strict && (r.unmentioned.files.length > 0 || r.unmentioned.adrs.length > 0 || drift > 0));
process.exit(fail ? 1 : 0);
