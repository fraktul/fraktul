---
title: Diagrams that chain
summary: Plain Mermaid flowcharts, with four small conventions that turn boxes into doors.
section: Concepts
---
Every block can carry an ordinary Mermaid flowchart in `diagram:`. fraktul adds no new syntax to Mermaid. It reads the
ids you already write, plus two kinds of comment that Mermaid ignores.

## A box whose id is a block is a door

```yaml
diagram: |
  flowchart TD
    question(["Customer asks"]) --> api
    api --> billing
```

`api` and `billing` are ids of other blocks, so their boxes get a badge, a hover peek of what's inside, and open on
click. You can leave out their labels; fraktul fills in the block's title. Give a label when you want different words
on the box.

## `block/inner` reaches inside

```yaml
diagram: |
  flowchart LR
    web --> api/charge
```

The edge lands on the `charge` box inside `api` when `api` is drawn open in this diagram, and on `api` itself
otherwise. The check makes sure `api` has a diagram and that it has a box called `charge`.

## `%% @link` opens code

```yaml
diagram: |
  flowchart LR
    charge["Charge the card"] --> policy["Refund policy"]
    %% @link charge src/api/payments.ts#charge
    %% @link policy adr:0007
```

A plain box can open a file (`path`), a function (`path#name`), a file in another repo (`billing:path`) or a decision
record (`adr:0007`). The check verifies every target.

## `%% @expand` builds bigger pictures

```yaml
diagram: |
  flowchart LR
    web --> api --> billing
    %% @expand api
```

Draws `api`'s own diagram inside this one, as a subgraph, when the diagram opens. That's how you compose a large
picture out of small blocks without copying anything. The expanded block must be in this diagram and have a diagram of
its own.

## Below the model

You don't draw the code levels. A block with file or function anchors and no diagram gets a generated one:

- **The block's code:** its files and functions, with imports and calls between them.
- **A file:** its functions and who calls whom, plus the functions it calls in other files.
- **A function:** its callers and callees. The panel shows its source, with each call a link into the function it calls.

None of this is written by hand, so it can't go out of date.

Functions call each other in every direction, so a function's level shows both sides: **who calls it on the left,
what it calls on the right**. Clicking either one swaps the function you are looking at; it does not take you deeper.
The breadcrumbs always say where a function lives (block, file, group, function), not the calls you followed to reach
it, so **Up** takes you to its file however long you have been wandering.

### Big files stay readable

A file with dozens of functions, drawn with every call as a line, is a hairball. fraktul draws a file of more than 20
functions the way a careful person would by hand:

- **The functions are gathered into named groups.** When the file has section headings, the groups are its sections.
  A heading is a comment at the left margin that is a title between rules (`// ───── Drawing ─────`,
  `# ==== Reading files ====`), a `// MARK: Title` line or a `#region Title` line. Without headings, fraktul follows
  the calls: each entry point (a function nothing else in the file calls) owns what only it reaches, and what
  several entry points reach is shared.
- **Two groups are joined by one line**, however many calls there are, drawn heavier when there are four or more.
- **Lines to helpers used all over the file are left out.** They say nothing about the flow. A function's own level
  still shows every caller and every call.

Click a group to open it: its functions and the calls between them, with the rest of the file as single boxes around
it. To get good groups, give a long file a few section headings. They help its human readers too.

## Links to any view

The address bar always says where you are, so any moment of the fraktul can be shared:

| Link | Opens |
|---|---|
| `#check` | The level of the block `check` |
| `#check/refs` | That level, with the box `refs` selected and its details in the panel |
| `#fraktul?tour=how-it-works&step=2` | The second stop of the tour `how-it-works` |
| `#check?view=3d` | The level in 3D, from the ground |
| `#check?view=3d&cam=bird` | The level in 3D, from a bird's eye |

A block's id is written with `-` for `_`. File, group and function levels have links too: open one and copy the
address. Without `view=3d` a link opens the flat, 2D view.

## Colours

Add a class to a box to say who or what does the work:

| Class | Use it for |
|---|---|
| `:::model` | a step an AI model takes |
| `:::code` | plain code |
| `:::human` | a person decides or acts |
| `:::data` | stored data |
| `:::ext` | an outside system |

```yaml
diagram: |
  flowchart LR
    ask(["Customer"]):::human --> sort["Sort the question"]:::model --> rules[("Rules")]:::data
```

The colours come from the current style and theme, so they work in light and dark. Your own `classDef` lines are
ignored for the same reason. `click` and `linkStyle` lines are dropped too: fraktul wires clicks itself, and
numbered link styles break when diagrams are combined.

## Tips

- Keep each diagram small: five to nine boxes. Put the detail one level down.
- Use the system's own words for labels, and the block's summary for the why.
- Draw the main flow left to right (`flowchart LR`) and keep the same direction across levels.
