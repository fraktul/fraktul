# Changelog

## 0.1.0

The first release on npm.

- **The map.** One model file (`model.yaml`) describes a system as blocks with plain Mermaid diagrams. A box whose id
  is another block opens that block. Files, functions, who calls whom and the source are read from the code.
- **The check.** `fraktul check` fails on a missing file, function, decision record, diagram box, narration cue or
  tour step, and lists the files the model does not mention yet.
- **`fraktul init`.** Writes a starter model from the project's folders that passes the check as written.
- **An agent skill.** `fraktul skill` installs instructions that teach an AI coding assistant to write and update the
  model.
- **Levels.** `kind: system | service | feature` names the level of a block; files and functions come from the code.
- **Traces.** `fraktul traces` reads OpenTelemetry traces (a Jaeger address or OTLP JSON) into `traces.json`. Service
  panels show real traffic, and the check lists calls and services the map does not draw.
- **A demo.** `fraktul example shop` puts a finished map of the OpenTelemetry Demo, with its traces, into a checkout
  of the demo.
- **Big files stay readable.** A file with more than 20 functions is drawn as named groups, with one line between two
  groups and no lines to helpers used everywhere.
- **Tours.** Step-by-step paths with branches, narrated by a local neural voice (Kokoro on MLX, Apple silicon), and
  walkthroughs you record yourself.
- **Links to any view.** The address carries the level, the selected box, the tour stop, and 2D or 3D.
- **3D.** The level on screen as a place to walk through, from the ground or a bird's eye.
- **Publishing.** `fraktul build` writes a static folder that loads nothing from a CDN (Mermaid, three.js and the fonts
  ship with fraktul); `fraktul artifact` writes one HTML file; `FRAKTUL_PUBLIC=1` leaves out the source.
