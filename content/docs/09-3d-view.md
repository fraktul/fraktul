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
| Click a block | Go inside it |
| <kbd>Esc</kbd> | Come back out |
| <kbd>0</kbd> | Replay the level rising |

## What the shapes mean

Nothing in 3D is decoration that could mislead. Meaning comes from the model and the code:

- **Shape follows `kind`.** Components are towers, data are crystals, people are pillars of light, and external
  systems are sealed monoliths.
- **Height follows lines of code**, where a block is anchored to code.
- **Solidity follows `status`.** Planned and proposed blocks are holograms.
- **Arrows are streams of light** moving in the direction of flow.
- **Tour steps light their boxes** with a beam.

Each block's crown and window pattern come from a hash of its id. A block keeps its silhouette when its code changes,
so the place stays familiar.

## Loading

three.js ships with fraktul and is served beside the page in `vendor/`, like Mermaid. It loads the first time someone
switches to 3D, so the 2D map stays light. A page published as a claude.ai Artifact has no `vendor/` folder and loads
three.js from a CDN instead.
