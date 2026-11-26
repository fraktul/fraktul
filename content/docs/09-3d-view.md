---
title: The 3D view
summary: Fly through the level on screen as a place: the same boxes and arrows, standing where Mermaid drew them.
section: Guides
---
**3D** in the map's toolbar, or the **3** key, turns the diagram on screen into a place you can fly through. It shows
the same boxes and arrows at the positions Mermaid drew them, so 2D and 3D always match. Press **3** again to go back.
The map remembers your choice in this browser.

## Moving around

| Input | Does |
|---|---|
| Drag | Look around |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Move forward, left, back, right |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Move forward / back |
| <kbd>←</kbd> / <kbd>→</kbd> | Turn |
| <kbd>Q</kbd> / <kbd>E</kbd> | Down / up |
| <kbd>Shift</kbd> | Move faster |
| Scroll | Move forward and back |
| Click a block | Fly into it and open it |
| <kbd>L</kbd> or **Lock mouse** | Lock the mouse: plain mouse moves look around, a click opens the block under the crosshair |
| <kbd>Esc</kbd> | Unlock the mouse; pressed again, come back out a level |
| <kbd>0</kbd> | Replay the level rising |

## What the shapes mean

Nothing in 3D is decoration that could mislead. Meaning comes from the model and the code:

- **Each block looks like what it is.** fraktul reads the box's words first, then the Mermaid shape it was written
  with, then the block's `kind`, then its colour class:

| It is | Drawn as | Picked up from |
|---|---|---|
| Database, table, store, cache | Stacked disks | "db", "database", "store", "cache"…, a `[( )]` box, `kind: data`, `:::data` |
| Disk, bucket, storage | A drive with a spinning platter | "disk", "storage", "bucket", "volume"… |
| Queue, stream, events | Envelopes on a rail | "queue", "stream", "topic", "events", "webhook"… |
| API, service, server | A server rack with status lights | "api", "service", "server", "worker", `kind: service` |
| Page, app, dashboard | A monitor on a stand | "page", "app", "ui", "dashboard", "site"… |
| CLI, script, job | A terminal with a prompt | "cli", "script", "command", "cron", "job" |
| Model, LLM, agent | A small neural network, turning | "model", "llm", "ai", "agent", "embedding", `:::model` |
| Function, algorithm, rule | A turning gear | a function level, "algorithm", "parse", "rank", "rules", `[[ ]]` boxes, `kind: step` |
| File, doc, report | A page with a folded corner | a file level, "file", "doc", "pdf", "report", `kind: doc` |
| Repo | A folder | "repo", "git", `kind: repo` |
| Person, team | A figure | "user", "customer", "team", `:::human`, `kind: person` |
| Decision | A diamond | a `{ }` box |
| Outside service | A cloud | `status: external`, `:::ext` |
| Decision record | A stone tablet | an ADR |
| Component, module | A parcel | `kind: component` or `module`, anything else with a diagram |
| A whole system | A campus | `kind: district` |

- **Height follows lines of code**, where a block is anchored to code.
- **Solidity follows `status`.** Planned and proposed blocks are holograms.
- **Arrows are streams of light** moving in the direction of flow.
- **Tour steps light their boxes** with a beam, and the camera flies to them and circles them slowly while the voice
  talks. Each narration cue moves the camera on. Ending the tour pulls back to the whole level.

Details (how many disks, rack units, gear teeth, network nodes) come from a hash of the block's id. A block keeps its silhouette when its code changes,
so the place stays familiar.

## Loading

three.js ships with fraktul and is served beside the page in `vendor/`, like Mermaid. It loads the first time someone
switches to 3D, so the 2D map stays light. A page published as a claude.ai Artifact has no `vendor/` folder and loads
three.js from a CDN instead.
