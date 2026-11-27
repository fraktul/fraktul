---
title: Core concepts
summary: Blocks, levels, anchors, the check and tours, and how they relate.
section: Concepts
---
fraktul has a small vocabulary. Once these five ideas make sense, the rest of the docs are details.

## Blocks

A **block** is one entry under `nodes:` in the model: a part of the system with a title, a summary, and optionally a
diagram of its own parts. The key you give it is its id.

```yaml
nodes:
  billing:
    title: Billing
    kind: component
    status: prototype
    summary: Turns finished orders into invoices.
```

`kind` says which level a block is (`system`, `service`, `feature`: see [Levels](/docs/levels)) or what sort of thing
it stands for (`component`, `module`, `data`, `person`, `repo`, `doc`, `step`). `status` says how real it is (`built`, `prototype`, `planned`, `proposed`, `external`). Planned blocks are
drawn dashed, and both fields shape the block in the [3D view](/docs/3d-view).

## Levels

The fraktul is a stack of levels. You go down by clicking a box and up with Esc.

| Level | Comes from | Written by |
|---|---|---|
| The system | the `root` block's diagram | you |
| Blocks inside blocks | each block's `diagram` | you |
| Code of a block | the block's file and function anchors | generated |
| A file | its functions and the calls between them | generated |
| A function | its callers, its callees and its source | generated |

[Levels](/docs/levels) describes the usual ladder: system, service, feature, file, function. The top levels explain
intent, which code can't. The bottom levels are read from the code on every build, so they
are never out of date. A box in a diagram becomes a door to the next level when its id is another block's id.

## Anchors

**Anchors** tie a block to the code: files, functions, data files, docs and decision records.

```yaml
    anchors:
      files: [src/billing/invoice.ts]
      functions: ["src/billing/invoice.ts#createInvoice"]
      data: [schema/invoices.sql]
      docs: [docs/billing.md]
      adrs: ["0007"]
```

Anchors do three jobs. The side panel lists them as links. A block with file or function anchors and no diagram gets
a generated diagram of that code. And the check verifies that every one of them exists.

Paths are relative to the root of a repo. A model can span several repos; see [Repos](/docs/model#repos).

## The check

`fraktul check` compares the model with the code. It **fails** when the model points at something that is gone: a
file, a function, a decision record, a box another diagram reaches into, or a tour step. It also **lists** files the
model doesn't mention yet, so new code shows up as "not mapped".

Run it in CI and the fraktul can't drift from the code. See [The check in CI](/docs/ci).

## Tours

A **tour** is a path through the fraktul: a list of steps, each showing one diagram with a few boxes highlighted and a
short card of text. Tours can branch, jump to other tours, and be spoken aloud by a local voice whose cues move the
highlight as it talks.

```yaml
tours:
  - id: one-invoice
    title: Follow one invoice
    summary: From a finished order to a sent invoice.
    steps:
      - view: shop
        focus: [billing]
        title: Billing takes over
        text: When an order ships, billing writes the invoice.
```

See [Tours and narration](/docs/tours).

## Putting it together

1. Write blocks and diagrams for the parts of the system people need to understand.
2. Anchor each block to its code. fraktul draws the code levels for you.
3. Run the check locally and in CI.
4. Add a tour for each question people ask about the system.
