---
title: Diagrams that chain
summary: Plain Mermaid, with three small conventions that turn boxes into doors.
---
Every block can carry an ordinary Mermaid flowchart. fraktul adds no new syntax to Mermaid itself; it reads the ids you
already write.

## A box whose id is a block is a door

```yaml
diagram: |
  flowchart TD
    question(["Customer asks"]) --> api
    api --> billing
```

`api` and `billing` are blocks, so their boxes get a badge, a hover preview of what's inside, and open on click. You
can leave out their labels; fraktul fills in the block's title.

## `block/inner` reaches inside

```yaml
    api/charge --> receipts
```

The edge lands on the `charge` box inside `api` when `api` is drawn open, and on `api` itself otherwise. The check
makes sure `charge` exists in `api`'s diagram.

## `%% @link` opens code

```yaml
    %% @link charge src/api/payments.ts#charge
    %% @link policy adr:0007
```

A plain box can open a file, a function, or a decision record.

## `%% @expand` builds bigger pictures

```yaml
    %% @expand api
```

Draws `api`'s diagram inside this one as a subgraph. That's how you compose a large diagram out of small blocks without
copying anything.

## Below the model

A block with files but no diagram gets a generated one. Every file is a diagram of its functions and who calls whom.
Every function shows its callers, its callees and its source, with each call a link into the function it calls. None
of this is written by hand, so it can't go out of date.

## Colours

Add a class to say who does the work: `:::model` (a model), `:::code`, `:::human` (a person decides), `:::data`,
`:::ext`. The legend on the map explains them.
