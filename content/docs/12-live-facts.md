---
title: Live facts
summary: Numbers, lists and decision records read from the project at every build, never typed into the map.
section: Guides
---
A map that repeats a number by hand is wrong the day that number changes. fraktul reads facts at build time instead,
and shows them in a block's side panel.

## Decision records

Set `adrs_dir` to a folder of Markdown decision records:

```yaml
adrs_dir: docs/adr
```

Every file named `NNNN-title.md` (four digits, then a dash) becomes a decision record. Its title is the first `#`
heading and its status is the `- Status:` line:

```text
# ADR 0007: Refunds go through the payment provider

- Status: Accepted (2026-03-02)

...
```

Records are listed, searchable, readable in the side panel and linked from the blocks that name them in
`anchors.adrs`. A diagram box can open one with `%% @link box adr:0007`. `live: [adrs]` on a block shows the whole
list. The check fails on a record number that doesn't exist and lists records the model never mentions.

## Your own facts

`live_module` names a TypeScript file, relative to the model. Its default export returns named fact blocks. A block
shows them with `live: [name]`.

```yaml
live_module: live.ts
nodes:
  tests:
    title: Test suite
    live: [run]
```

```ts
// docs/arch/live.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

The function may be `async`. It runs on every build, including every rebuild in `fraktul dev`.

### The context

| Field | What it is |
|---|---|
| `ctx.project` | Absolute path of the project root. |
| `ctx.modelDir` | Absolute path of the folder that holds the model. |
| `ctx.repoRoot(key)` | Absolute path of a repo from `repos:`, or `null` when it isn't checked out. |
| `ctx.adrs` | The decision records, each with `num`, `title`, `status`, `file` and `text`. |

### What a fact block can hold

| Field | Shows |
|---|---|
| `title` | Required. The heading. |
| `rows` | A small table of `[label, value]` pairs. |
| `bar` | A stacked bar: `{ label, value, tone }`, with tone `good`, `warn`, `bad` or `neutral`. |
| `list` | Items `{ label, note, key }`. A `key` makes the item open something (below). |
| `fold` | `true` folds a long list under "All". |
| `groups` | Labelled groups of items: `{ label, note, items }`. |
| `text` | A paragraph. |
| `source` | Where the facts came from, shown small. |

A list item's `key` opens a block (`node:billing`), a file (`file:main:src/api/orders.ts`), a function
(`fn:main:src/api/orders.ts#createOrder`) or a decision record (`adr:0007`).

> [!TIP]
> For type checking, import the types from fraktul's `src/lib/live.ts`: `LiveContext` and `LiveBlock`. They are
> optional; a plain function works.
