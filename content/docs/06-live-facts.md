---
title: Live facts
summary: Numbers and lists read from the project at every build, never typed into the map.
---
A map that repeats a number by hand is wrong the day that number changes. fraktul reads facts at build time instead.

## Decision records

Set `adrs_dir` and every `NNNN-title.md` file with a `- Status:` line becomes a decision record: listed, searchable,
linked from the blocks that name it, and readable in the side panel. `live: [adrs]` shows the list on a block.

## Your own facts

`live_module` names a TypeScript file next to the model. Its default export returns named blocks; a node shows them
with `live: [name]`.

```ts
// docs/arch/live.ts
export default function (ctx) {
  const runs = JSON.parse(readFileSync(join(ctx.project, "results/latest.json"), "utf8"));
  return {
    run: {
      title: "Latest test run",
      bar: [{ label: "pass", value: runs.pass, tone: "good" }, { label: "fail", value: runs.fail, tone: "bad" }],
      rows: [["Passed", runs.pass], ["Failed", runs.fail]],
      source: "results/latest.json",
    },
  };
}
```

A block can carry `rows`, a stacked `bar` (tones good, warn, bad, neutral), a `list` whose items can open things,
`groups`, `text`, and a `source` line. `ctx` gives the project root, the model's folder, each repo's location, and the
decision records.
