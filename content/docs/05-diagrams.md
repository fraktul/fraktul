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
