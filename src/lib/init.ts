// `fraktul init`: a first model for a project, written from the folders git tracks. It gives every big folder a block
// with its files anchored, puts the blocks on one diagram, and adds a short tour. The result passes `fraktul check`
// as it is; the reader then writes the summaries and draws the arrows, which code cannot tell fraktul.

const CODE = /\.(ts|mts|tsx|js|mjs|jsx|py|go|rs|java|kt|rb|php|cs|swift|c|cc|cpp|h)$/;
const SKIP = /(^|\/)(node_modules|dist|build|out|vendor|third_party|coverage|\.[^/]+)\/|\.(test|spec|d|min)\.[a-z]+$|(^|\/)(tests?|__tests__|fixtures)\//;
const MAX_BLOCKS = 8;
const MAX_FILES = 12;

export type StarterBlock = { id: string; title: string; folder: string; files: string[]; total: number };

const titleOf = (folder: string) => {
  const last = folder.split("/").pop()!.replace(/[-_.]+/g, " ").trim();
  return last ? last[0].toUpperCase() + last.slice(1) : folder;
};

/** Groups a project's tracked code files into blocks, one per big folder. `files` are paths from the project root. */
export function starterBlocks(files: string[]): StarterBlock[] {
  const code = files.filter((f) => CODE.test(f) && !SKIP.test(f));
  const group = (depth: number) => {
    const groups = new Map<string, string[]>();
    for (const f of code) {
      const parts = f.split("/");
      if (parts.length < 2) continue;
      const key = parts.slice(0, Math.min(depth, parts.length - 1)).join("/");
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return groups;
  };
  // One folder holding nearly everything (src/, app/, lib/) says little: describe what is inside it instead.
  let groups = group(1);
  const biggest = Math.max(0, ...[...groups.values()].map((g) => g.length));
  const inside = group(2);
  if (code.length && (groups.size === 1 ? inside.size >= 1 : biggest / code.length > 0.7 && inside.size > 1)) groups = inside;
  const taken = new Set(["system"]);
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, MAX_BLOCKS)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([folder, list]) => {
      const base = folder.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "b$1") || "block";
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
      taken.add(id);
      return { id, title: titleOf(folder), folder, files: list.sort().slice(0, MAX_FILES), total: list.length };
    });
}

const q = (s: string) => JSON.stringify(s);

/** The starter model.yaml for a project called `name` whose tracked files are `files`. */
export function starterModel(name: string, files: string[]): string {
  const blocks = starterBlocks(files);
  const title = titleOf(name);
  const head = `# ${title}, mapped with fraktul. Every field is explained at https://fraktul.dev/docs/model
#
# Next:
#   1. Replace each TODO with a sentence a newcomer would understand.
#   2. Draw the arrows in the diagram below: who calls whom, where the data goes.
#   3. Run \`fraktul check\`, then \`fraktul dev\` to open the fraktul.
version: 1
title: ${q(`${title} system map`)}
root: system
repos:
  main: { path: "." }
`;
  if (!blocks.length) {
    return `${head}
nodes:
  system:
    title: ${q(title)}
    kind: system
    summary: "TODO: what this system is for, and who uses it."
    # Plain Mermaid. Give a box its own entry under nodes: (same id) and it becomes a door you can click into.
    diagram: |
      flowchart LR
        user(["Someone"]) --> app["The app"] --> data[("Its data")]
`;
  }
  const nodes = blocks.map((b) => `  ${b.id}:
    title: ${q(b.title)}
    kind: component
    status: built
    summary: ${q(`TODO: what ${b.folder}/ does, in one sentence.`)}
    anchors:${b.total > b.files.length ? `\n      # ${b.total - b.files.length} more files live in ${b.folder}/: add the ones that matter, or split this block in two.` : ""}
      files:
${b.files.map((f) => `        - ${q(f)}`).join("\n")}`).join("\n");
  const steps = blocks.map((b) => `      - view: system
        focus: [${b.id}]
        title: ${q(b.title)}
        text: ${q(`TODO: what a newcomer should know about ${b.folder}/.`)}`).join("\n");
  return `${head}
nodes:
  system:
    title: ${q(title)}
    kind: system
    summary: "TODO: what this system is for, and who uses it."
    # Plain Mermaid. A box whose id is another block opens that block. fraktul cannot guess how the blocks connect:
    # add the arrows, for example \`${blocks[0].id} --> ${blocks[1]?.id ?? "somewhere"}\`.
    diagram: |
      flowchart LR
${blocks.map((b) => `        ${b.id}`).join("\n")}

${nodes}

# A tour walks someone through the fraktul, one step at a time. Add \`say:\` to a step and \`fraktul voice\` narrates it.
tours:
  - id: first-look
    title: A first look
    summary: The big pieces, one at a time.
    steps:
${steps}
`;
}
