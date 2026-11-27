---
title: Levels
summary: Systems, services, features, files and functions - one map from 30,000 feet down to a line of code.
section: Concepts
---
Most diagrams show one altitude. An architecture slide shows the systems and nothing below. A call graph shows the
functions and nothing above. People need both, and they need to get from one to the other.

A fraktul map is every altitude in one place. You start at 30,000 feet and click down until you are reading the
code, or stop at whatever level answers your question.

## The ladder

| Level | What it shows | Who it is for | Where it comes from |
|---|---|---|---|
| **System** | The whole thing: who uses it, the big parts, what it depends on outside | Anyone. A customer, a new hire, an executive | You write it |
| **Service** | One deployed part: what it does and what it talks to | Product, support, engineers on other teams | You write it; traces confirm it |
| **Feature** | One thing the product does, step by step: "checkout", "password reset" | Product managers, QA, the engineer about to change it | You write it |
| **File** | The functions in a file and the calls between them | Engineers | Read from the code |
| **Function** | Who calls it, what it calls, its source | Engineers | Read from the code |

You write the top three, because code cannot say what a system is for. fraktul reads the bottom two on every
build, so they are never out of date.

[The demo map](/fraktuls/shop/) shows the whole ladder on a real system: an online shop of about twenty services. Its top
level has nine boxes; three clicks later you are reading a function.

## Saying which level a block is

`kind` names the level:

```yaml
nodes:
  shop:
    title: Shop
    kind: system
    summary: Customers browse products, pay, and get their order delivered.
  checkout:
    title: Checkout
    kind: service
    summary: Turns a cart into a paid order.
  refunds:
    title: Refunds
    kind: feature
    summary: Gives a customer their money back, in full or in part.
```

The map shows the level above each block's summary, and the [3D view](/docs/3d-view) draws each level differently.
The other kinds (`component`, `module`, `data`, `person`, `repo`, `doc`, `step`) say what a box stands for rather
than how high up it is.

## How many levels you need

As many as the system has. The ladder is a guide, not a rule:

- **A small app** needs two written levels: the system, then its features. The code levels follow.
- **A platform of services** needs three: the system, each service, the features inside each.
- **A company with several products** adds one on top: a root block whose diagram shows the systems.

A feature often crosses services. Draw it once, as its own block, with a diagram of the steps in order; each step can
be a door into the service that performs it.

## Explaining a system to someone who doesn't write code

The top of the map is for everyone, so write it for everyone:

- **Summaries in plain words.** "Takes the customer's card and asks the bank for the money", not "wraps the payment
  SDK".
- **Five to nine boxes per level.** More than that and nobody reads it. Group some into a block and give it a
  diagram of its own.
- **A tour for the big picture.** A [tour](/docs/tours) that stays on the top two levels is a five-minute
  explanation of the system you can send to anyone. With narration it explains itself.

The same map then carries an engineer the rest of the way down, so the picture a product manager sees and the code
an engineer changes are one thing, not two documents that drift apart.

## Going down, and back up

Click a box with a badge to go down a level. **Up**, the breadcrumbs or <kbd>Esc</kbd> go back up. The breadcrumbs
always read as the ladder: system, service, feature, file, function. Every level has [its own link](/docs/diagrams#links-to-any-view),
so you can send someone straight to the altitude they need.
