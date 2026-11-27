// The explorer in the browser: assembles Mermaid text from the parsed diagrams (with blocks expanded in place), renders
// it, wires open / expand / peek on every box, and runs the tours. Data comes from the build (<script data-fraktul-data>).

type Tok = { id: string; inner?: string; shape: string; cls: string };
type Line = { t: string; tok: Tok[]; bare?: string; kind?: string };
type Diagram = { header: string; direction: string; lines: Line[]; ids: string[]; expand: string[]; title: string; targets: Record<string, string>; generated?: boolean };
type Anchor = { kind: string; key: string; label: string; missing?: boolean };
type NodeInfo = { id: string; title: string; kind?: string; status?: string; summary?: string; detail?: string; live?: string[]; anchors: Anchor[]; usedIn: string[] };
type FileInfo = { key: string; repo: string; path: string; lang: string; lines: number; doc: string; functions: string[]; imports: string[]; importedBy: string[]; url: string | null; excerpt?: string; exists: boolean };
type FnInfo = { key: string; file: string; name: string; line: number; end: number; doc: string; params: string; exported: boolean; code: string; calls: string[]; calledBy: string[]; url: string | null };
type Step = { id: string; view: string; focus?: string[]; expand?: string[]; title: string; text: string; next?: string; branches?: { label: string; to: string }[] };
type Tour = { id: string; title: string; summary: string; steps: Step[] };
type Site = {
  meta: { built: string; commit: string | null; root: string; repos: Record<string, { title: string; github: string | null; present: boolean; remote: string | null; host: string | null; restricted: boolean }>; defaultRepo: string; title: string; brand: string; voice: any };
  nodes: Record<string, NodeInfo>;
  diagrams: Record<string, Diagram>;
  files: Record<string, FileInfo>;
  fns: Record<string, FnInfo>;
  parts: Record<string, { key: string; file: string; title: string; note: string; functions: string[] }>;
  live: any;
  tours: Tour[];
};
type View = { key: string; expanded: string[] };
type Box = { rid: string; target: string | null; box: string; title: string; expandable: boolean; expanded: boolean };

declare const mermaid: any;
/** A touch screen without a mouse: no hover, no keyboard shortcuts, no mouse lock, no recording. */
const touchy = matchMedia("(hover: none) and (pointer: coarse)").matches;
if (touchy) (document.getElementById("search") as HTMLInputElement).placeholder = "Find a block, file or function";


const SITE: Site = JSON.parse((document.getElementById("fraktul-data") as HTMLElement).textContent || "{}");
const board = (document.getElementById("board") as HTMLElement), canvas = (document.getElementById("canvas") as HTMLElement), panel = (document.getElementById("panel") as HTMLElement), peek = (document.getElementById("peek") as HTMLElement), crumbsEl = (document.getElementById("crumbs") as HTMLElement);
const tourCard = (document.getElementById("tour-card") as HTMLElement), search = (document.getElementById("search") as HTMLElement) as HTMLInputElement, results = (document.getElementById("results") as HTMLElement);
const toursDlg = (document.getElementById("tours") as HTMLElement) as HTMLDialogElement;

// ───────────── small DOM helper (text only: nothing from the data is parsed as HTML) ─────────────
function el(tag: string, cls?: string | null, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
}
function button(label: string, cls: string, on: () => void, title?: string): HTMLButtonElement {
  const b = el("button", cls, label) as HTMLButtonElement;
  b.type = "button";
  if (title) b.title = title;
  b.addEventListener("click", (ev) => { ev.stopPropagation(); on(); });
  return b;
}

// ───────────── what a key is ─────────────
const kindOf = (key: string) => key.split(":")[0];
const nodeOf = (key: string) => (kindOf(key) === "node" ? SITE.nodes[key.slice(5)] : undefined);
const adrOf = (key: string) => SITE.live.adrs.find((a: any) => `adr:${a.num}` === key);
function titleOf(key: string): string {
  const k = kindOf(key);
  if (k === "node") return SITE.nodes[key.slice(5)]?.title ?? key;
  if (k === "file") return SITE.files[key]?.path.split("/").pop() ?? key;
  if (k === "fn") return `${SITE.fns[key]?.name ?? key.split("#")[1]}()`;
  if (k === "part") return SITE.parts?.[key]?.title ?? key.split("#")[1];
  if (k === "adr") { const a = adrOf(key); return a ? `ADR ${a.num}` : key; }
  return key;
}
function statusOf(key: string): string | undefined {
  return nodeOf(key)?.status;
}
const hasDiagram = (key: string | null) => !!key && !!SITE.diagrams[key];
const openable = (key: string | null) => !!key && (hasDiagram(key) || kindOf(key) === "adr" || !!SITE.files[key]);

// ───────────── assemble Mermaid text: a diagram, with blocks expanded in place ─────────────
// Diagram colours come from the design tokens (tokens.css), read when a diagram is drawn, so light and dark both follow.
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(`--${n}`).trim();
  const box = (n: string, extra = "") => `fill:${v(`n-${n}`)},stroke:${v(`n-${n}-line`)},color:${v("ink")}${extra}`;
  return {
    model: box("model"), code: box("code"), human: box("human"), data: box("data"), ext: box("ext"),
    fn: box("fn"), fnx: box("fn", ",stroke-width:2px"), file: box("file"), part: box("file", ",stroke-width:2px,font-weight:600"),
    focus: box("focus", ",stroke-width:3px"), district: box("district", ",stroke-width:2px,font-weight:600"),
    planned: "stroke-dasharray:6 4", drill: "stroke-width:2.2px",
    base: { primaryColor: v("n-plain"), primaryBorderColor: v("n-plain-line"), primaryTextColor: v("ink"), lineColor: v("ink-2"), clusterBkg: v("paper-2"), clusterBorder: v("line"), edgeLabelBackground: v("paper"), tertiaryColor: v("paper"), fontFamily: v("body"), fontSize: "14px" },
  };
}

type Assembled = { text: string; boxes: Map<string, Box> };

function assemble(key: string, expanded: Set<string>, opts: { mini?: boolean } = {}): Assembled {
  const d = SITE.diagrams[key];
  const boxes = new Map<string, Box>();
  const drill: string[] = [], planned: string[] = [], districts: string[] = [];
  const out: string[] = [];

  function emit(diag: Diagram, prefix: string, chain: string[], indent: string) {
    const declared = new Set<string>();
    const labeled = new Set<string>();
    const shapedIds = new Set(diag.lines.flatMap((l) => l.tok.filter((t) => t.shape && !t.inner).map((t) => t.id)));
    const rid = (id: string) => `${prefix}${id}`;
    const isExp = (id: string) => !opts.mini && expanded.has(rid(id)) && hasDiagram(diag.targets[id]) && !chain.includes(diag.targets[id]);
    const block = (id: string) => {
      const target = diag.targets[id];
      const child = SITE.diagrams[target];
      const label = (titleOf(target) || id).replace(/"/g, "#quot;");
      out.push(`${indent}subgraph ${rid(id)}["${label}"]`);
      out.push(`${indent}  direction ${child.direction === "TD" ? "TB" : child.direction}`);
      emit(child, `${rid(id)}__`, [...chain, target], indent + "  ");
      out.push(`${indent}end`);
      boxes.set(rid(id), { rid: rid(id), target, box: id, title: titleOf(target), expandable: true, expanded: true });
      declared.add(id);
    };
    for (const line of diag.lines) {
      if (line.kind === "class" || line.kind === "style") {
        const keep = line.tok.filter((t) => !isExp(t.id));
        if (!keep.length) continue;
        if (line.kind === "class") { out.push(`${indent}class ${keep.map((t) => rid(t.id)).join(",")} ${line.t.split(" ").pop()}`); continue; }
      }
      if (line.bare && isExp(line.bare)) { if (!declared.has(line.bare)) block(line.bare); continue; }
      for (const t of line.tok) if (isExp(t.id) && !declared.has(t.id)) block(t.id);
      const text = line.t.replace(/\u0001(\d+)\u0002/g, (_m, i) => {
        const t = line.tok[Number(i)];
        if (t.inner && isExp(t.id)) return `${rid(t.id)}__${t.inner}`;
        if (isExp(t.id)) return rid(t.id);
        const target = diag.targets[t.id] ?? null;
        // A block written only by id (or as block/inner) gets its title as label the first time it appears.
        let shape = t.inner ? "" : t.shape;
        if (!shape && !labeled.has(t.id) && !shapedIds.has(t.id) && target) shape = `["${titleOf(target).replace(/"/g, "#quot;")}"]`;
        if (shape) labeled.add(t.id);
        if (!boxes.has(rid(t.id))) {
          boxes.set(rid(t.id), { rid: rid(t.id), target, box: t.id, title: target ? titleOf(target) : t.id, expandable: hasDiagram(target) && !chain.includes(target!) && !!target && kindOf(target) === "node", expanded: false });
          if (openable(target) && target !== key) drill.push(rid(t.id));
          const st = target ? statusOf(target) : undefined;
          if (st === "planned") planned.push(rid(t.id));
          if (target && nodeOf(target)?.kind === "district" && !t.cls) districts.push(rid(t.id));
        }
        return `${rid(t.id)}${shape}${t.inner ? "" : t.cls}`;
      });
      if (/^classDef\b/.test(text)) continue;
      out.push(indent + text);
    }
  }
  emit(d, "", [key], "  ");
  const th = theme();
  const defs = Object.entries(th).filter(([k]) => k !== "base").map(([k, v]) => `  classDef ${k} ${v}`);
  const tail: string[] = [];
  if (districts.length) tail.push(`  class ${districts.join(",")} district`);
  if (drill.length) tail.push(`  class ${drill.join(",")} drill`);
  if (planned.length) tail.push(`  class ${planned.join(",")} planned`);
  const header = d.header.replace(/^graph\b/, "flowchart");
  return { text: [header, ...defs, ...out, ...tail].join("\n"), boxes };
}

// ───────────── Mermaid ─────────────
let renderCount = 0;
let mermaidReady = false;
function initMermaid() {
  const th = theme();
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: th.base, flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: false, padding: 10, nodeSpacing: 36, rankSpacing: 46 } });
  mermaidReady = true;
}
async function render(text: string): Promise<string> {
  if (!mermaidReady) initMermaid();
  const { svg } = await mermaid.render(`m${++renderCount}`, text);
  return svg;
}

// ───────────── state ─────────────
let stack: View[] = [];
let selected: string | null = null; // a target key, or null for the view itself
let selectedRid: string | null = null; // the box it was selected from
let linkRid: string | null = null; // a box named by the link, selected once its level is drawn
let tour: { t: Tour; step: Step; trail: string[] } | null = null;
let current: { boxes: Map<string, Box>; svg: SVGSVGElement | null; els: Map<string, Element> } = { boxes: new Map(), svg: null, els: new Map() };
const view = () => stack[stack.length - 1];

function pathTo(nodeId: string): string[] {
  // Breadth-first from the root through model diagrams: the usual way down to a node.
  const start = `node:${SITE.meta.root}`, goal = `node:${nodeId}`;
  const prev = new Map<string, string | null>([[start, null]]);
  const q = [start];
  while (q.length) {
    const k = q.shift()!;
    if (k === goal) break;
    for (const t of Object.values(SITE.diagrams[k]?.targets ?? {})) if (kindOf(t) === "node" && hasDiagram(t) && !prev.has(t)) { prev.set(t, k); q.push(t); }
  }
  if (!prev.has(goal)) return [start, goal].filter((k, i, a) => a.indexOf(k) === i && hasDiagram(k));
  const path: string[] = [];
  for (let k: string | null = goal; k; k = prev.get(k) ?? null) path.unshift(k);
  return path;
}

function openKey(key: string, o: { replace?: boolean; expanded?: string[]; push?: boolean } = {}) {
  if (kindOf(key) === "adr" || (!hasDiagram(key) && SITE.files[key])) { select(key); return; }
  if (!hasDiagram(key)) { select(key); return; }
  const v: View = { key, expanded: o.expanded ?? [...(SITE.diagrams[key].expand ?? [])] };
  if (o.replace) stack = [v]; else stack.push(v);
  selected = null;
  syncHash();
  draw();
}
function goTo(nodeId: string, expanded?: string[]): Promise<void> {
  const path = pathTo(nodeId);
  stack = path.map((k, i) => ({ key: k, expanded: i === path.length - 1 && expanded ? expanded : [...(SITE.diagrams[k]?.expand ?? [])] }));
  selected = null;
  syncHash();
  return draw();
}
function back() {
  if (stack.length > 1) { stack.pop(); selected = null; syncHash(); draw(); }
}
// The address always says where you are, so any moment of the map can be shared as a link:
//   #<view>[/<box>][?tour=<id>&step=<n>][&view=3d[&cam=bird]]
// <view> is a block's id (with - for _) or, for a file or function level, its key; <box> is the selected box;
// tour and step put the reader on that stop of a tour.
const viewSlug = (k: string) => (kindOf(k) === "node" ? k.slice(5).replace(/_/g, "-") : encodeURIComponent(k));
function syncHash() {
  if (!stack.length) return;
  let want = viewSlug(view().key);
  if (selectedRid && current.boxes.has(selectedRid)) want += `/${encodeURIComponent(selectedRid)}`;
  const q: string[] = [];
  if (tour) q.push(`tour=${encodeURIComponent(tour.t.id)}`, `step=${tour.t.steps.indexOf(tour.step) + 1}`);
  if (in3d) q.push("view=3d");
  if (in3d && F3D.bird) q.push("cam=bird");
  if (q.length) want += `?${q.join("&")}`;
  if (location.hash.slice(1) !== want) history.replaceState(null, "", `#${want}`);
}
/** The way down to any level: through the model's diagrams, then through files and functions. */
function stackTo(key: string): string[] {
  if (kindOf(key) === "node") return pathTo(key.slice(5));
  const start = `node:${SITE.meta.root}`;
  const prev = new Map<string, string | null>([[start, null]]);
  const q = [start];
  while (q.length) {
    const k = q.shift()!;
    if (k === key) break;
    for (const t of Object.values(SITE.diagrams[k]?.targets ?? {})) if (hasDiagram(t) && !prev.has(t)) { prev.set(t, k); q.push(t); }
  }
  if (!prev.has(key)) return [start, key];
  const path: string[] = [];
  for (let k: string | null = key; k; k = prev.get(k) ?? null) path.unshift(k);
  return path;
}

// ───────────── drawing ─────────────
let zoom = { s: 1, x: 0, y: 0 };
const orient = new Map<string, boolean>(); // view key → drawn with the other direction
function flip(text: string): string {
  const [head, ...rest] = text.split("\n");
  const swap: Record<string, string> = { LR: "TB", RL: "BT", TB: "LR", TD: "LR", BT: "RL" };
  return [head.replace(/\b(LR|RL|TB|TD|BT)\b/, (d) => swap[d]), ...rest].join("\n");
}
async function draw(keepZoom = false) {
  const v = view();
  if (!keepZoom) selectedRid = null;
  const { text, boxes } = assemble(v.key, new Set(v.expanded));
  drawCrumbs();
  let svgText: string;
  try {
    svgText = await render(orient.get(v.key) ? flip(text) : text);
    // A diagram much wider than the canvas (long left-to-right chains) reads better top-down, and the other way round.
    const m = svgText.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);
    const r = canvas.getBoundingClientRect();
    if (m && !orient.has(v.key)) {
      const ratio = Number(m[1]) / Number(m[2]), room = r.width / Math.max(1, r.height);
      orient.set(v.key, ratio > room * 2.2 || ratio < room / 3.2);
      if (orient.get(v.key)) svgText = await render(flip(text));
    }
  } catch (err) {
    board.replaceChildren(el("div", "error", el("strong", null, "This diagram has a Mermaid error. "), String((err as Error).message ?? err), el("pre", null, text)));
    return;
  }
  const holder = document.createElement("div");
  holder.innerHTML = svgText; // Mermaid's own output, rendered with securityLevel "strict"
  const svg = holder.querySelector("svg") as SVGSVGElement;
  board.replaceChildren(svg);
  current = { boxes, svg, els: new Map() };
  decorate(svg, boxes);
  // A link can name a box on this level: select it, as a click on a plain box would.
  if (linkRid) { const b = boxes.get(linkRid); linkRid = null; if (b) { selected = b.target ?? `box:${b.box}`; selectedRid = b.rid; } }
  if (selectedRid) current.els.get(selectedRid)?.classList.add("is-selected");
  syncHash();
  if (!keepZoom) fit(); else applyZoom();
  applyTourFocus();
  drawPanel();
  logEvent({ kind: "view", stack: JSON.parse(JSON.stringify(stack)) });
  after3d();
}

function ridOf(elem: Element): string | null {
  const m = elem.id.match(/flowchart-(.+)-\d+$/);
  return m ? m[1] : null;
}

let gradientCount = 0;
/** y2k style: district and plain boxes get a brushed-metal fill (an SVG gradient made from the --metal-* tokens). */
function chromeMetal(svg: SVGSVGElement) {
  if (document.documentElement.dataset.style !== "y2k") return;
  const NS = "http://www.w3.org/2000/svg";
  const cs = getComputedStyle(document.documentElement);
  const stops = [0, 1, 2, 3, 4].map((i) => cs.getPropertyValue(`--metal-${i}`).trim()).filter(Boolean);
  if (stops.length < 5) return;
  const id = `fk-metal-${++gradientCount}`;
  const defs = document.createElementNS(NS, "defs");
  const lg = document.createElementNS(NS, "linearGradient");
  lg.setAttribute("id", id);
  lg.setAttribute("x1", "0"); lg.setAttribute("y1", "0"); lg.setAttribute("x2", "0"); lg.setAttribute("y2", "1");
  [0, 0.42, 0.5, 0.58, 1].forEach((o, i) => {
    const st = document.createElementNS(NS, "stop");
    st.setAttribute("offset", String(o));
    st.setAttribute("stop-color", stops[i]);
    lg.append(st);
  });
  defs.append(lg);
  svg.prepend(defs);
  const CATEGORY = ["model", "code", "human", "data", "ext", "fn", "fnx", "file", "focus"];
  svg.querySelectorAll("g.node").forEach((g) => {
    if (CATEGORY.some((c) => g.classList.contains(c))) return;
    g.querySelectorAll(".label-container, .label-container > *, :scope > rect, :scope > polygon").forEach((shape) => (shape as SVGElement).style.setProperty("fill", `url(#${id})`, "important"));
    g.classList.add("is-metal");
  });
}

function decorate(svg: SVGSVGElement, boxes: Map<string, Box>) {
  const NS = "http://www.w3.org/2000/svg";
  chromeMetal(svg);
  svg.querySelectorAll("g.node").forEach((g) => {
    const rid = ridOf(g);
    const b = rid ? boxes.get(rid) : undefined;
    if (!b) return;
    (g as HTMLElement).dataset.rid = b.rid;
    current.els.set(b.rid, g);
    g.setAttribute("tabindex", "0");
    if (openable(b.target) && b.target !== view().key) {
      g.classList.add("is-drill");
      const bb = (g as SVGGraphicsElement).getBBox();
      const badge = document.createElementNS(NS, "g");
      badge.setAttribute("class", "drill-badge");
      badge.setAttribute("transform", `translate(${bb.x + bb.width - 4},${bb.y + 4})`);
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "9");
      const p = document.createElementNS(NS, "path");
      // Two stacked sheets: "there is a diagram inside".
      p.setAttribute("d", b.expandable || hasDiagram(b.target) ? "M-4.5,-1.5h6v5h-6z M-2,-4h6v5" : "M-3.5,-4h5l2,2v6h-7z");
      badge.append(c, p);
      g.append(badge);
    }
    if (b.target && statusOf(b.target) === "planned") g.classList.add("is-planned");
  });
  svg.querySelectorAll("g.cluster").forEach((g) => {
    const b = boxes.get(g.id) ?? [...boxes.values()].find((x) => x.expanded && g.id.endsWith(x.rid));
    if (!b || !b.expanded) return;
    g.classList.add("is-expanded");
    (g as HTMLElement).dataset.rid = b.rid;
    current.els.set(b.rid, g);
  });
}

// ───────────── zoom and pan ─────────────
function applyZoom() {
  if (current.svg) current.svg.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`;
}
function fit() {
  const svg = current.svg;
  if (!svg) return;
  const w = Number(svg.getAttribute("width")) || svg.viewBox.baseVal.width || svg.getBBox().width;
  const h = Number(svg.getAttribute("height")) || svg.viewBox.baseVal.height || svg.getBBox().height;
  svg.style.width = `${w}px`;
  svg.style.height = `${h}px`;
  svg.style.maxWidth = "none";
  const r = canvas.getBoundingClientRect();
  const pad = r.width < 600 ? 14 : 40;
  // While a tour card is open on a wide screen, fit the diagram into the space beside it.
  const left = !tourCard.hidden && !tourCard.classList.contains("is-min") && !tourCard.classList.contains("is-moved") && r.width > 900 ? tourCard.offsetWidth + 24 : 0;
  const s = Math.max(0.15, Math.min(1.25, (r.width - left - pad * 2) / w, (r.height - pad * 2 - 40) / h));
  zoom = { s, x: left + (r.width - left - w * s) / 2, y: Math.max(pad / 2, (r.height - 40 - h * s) / 2) };
  applyZoom();
}
function zoomAt(f: number, cx?: number, cy?: number) {
  const r = canvas.getBoundingClientRect();
  const x = cx ?? r.width / 2, y = cy ?? r.height / 2;
  const s = Math.min(4, Math.max(0.1, zoom.s * f));
  zoom = { s, x: x - ((x - zoom.x) * s) / zoom.s, y: y - ((y - zoom.y) * s) / zoom.s };
  applyZoom();
}
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2 && !e.shiftKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
  else { zoom.x -= e.deltaX; zoom.y -= e.deltaY; applyZoom(); }
}, { passive: false });
let drag: { x: number; y: number; zx: number; zy: number; moved: boolean } | null = null;
// Two fingers on a touch screen: pinch to zoom around the point between them.
const touches = new Map<number, { x: number; y: number }>();
let pinch: { d: number; s: number } | null = null;
const spread = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
canvas.addEventListener("pointerdown", (e) => {
  if ((e.target as Element).closest(".tour-card, .legend, .peek")) return;
  if (e.pointerType === "touch") {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && !in3d) { pinch = { d: spread().d, s: zoom.s }; if (drag) drag.moved = true; return; }
  }
  drag = { x: e.clientX, y: e.clientY, zx: zoom.x, zy: zoom.y, moved: false };
});
const dropTouch = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
window.addEventListener("pointerup", dropTouch);
window.addEventListener("pointercancel", dropTouch);
window.addEventListener("pointermove", (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const p = spread(), r = canvas.getBoundingClientRect();
    zoomAt((pinch.s * (p.d / pinch.d)) / zoom.s, p.cx - r.left, p.cy - r.top);
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add("is-panning"); hidePeek(); }
  if (drag.moved) { zoom.x = drag.zx + dx; zoom.y = drag.zy + dy; applyZoom(); }
});
window.addEventListener("pointerup", () => { setTimeout(() => { drag = null; canvas.classList.remove("is-panning"); }, 0); });
(document.getElementById("zoom-in") as HTMLElement).addEventListener("click", () => zoomAt(1.25));
(document.getElementById("zoom-out") as HTMLElement).addEventListener("click", () => zoomAt(0.8));
(document.getElementById("zoom-fit") as HTMLElement).addEventListener("click", fit);
window.addEventListener("resize", () => fit());

// ───────────── clicks on boxes ─────────────
/** The box or expanded block an element belongs to (walks up to the element decorate() tagged). */
function ridElement(start: Element | null): HTMLElement | null {
  for (let n: Element | null = start; n && n !== board; n = n.parentElement) if ((n as HTMLElement).dataset?.rid) return n as HTMLElement;
  return null;
}
function boxFromEvent(e: Event): Box | null {
  const g = ridElement(e.target as Element);
  return g ? current.boxes.get(g.dataset.rid!) ?? null : null;
}
// One way down: click a box with the badge to open it. A plain box shows what it is on the right.
board.addEventListener("click", (e) => {
  if (drag?.moved) return;
  clickBox(boxFromEvent(e));
});
function clickBox(b: Box | null) {
  if (!b) { if (selected) { selected = null; drawPanel(); markSelected(); } return; }
  hidePeek();
  if (b.target && openable(b.target) && b.target !== view().key) { openKey(b.target); return; }
  selected = b.target ?? `box:${b.box}`;
  if (panel.hidden) setPanel(true);
  drawPanel();
  markSelected(b.rid);
  logEvent({ kind: "select", key: selected });
}
board.addEventListener("keydown", (e) => {
  const b = boxFromEvent(e);
  if (!b) return;
  if (e.key === "Enter" && b.target && openable(b.target)) { e.preventDefault(); openKey(b.target); }
})
function markSelected(rid?: string) {
  current.svg?.querySelectorAll(".is-selected").forEach((x) => x.classList.remove("is-selected"));
  if (rid) current.els.get(rid)?.classList.add("is-selected");
  selectedRid = rid ?? null;
  syncHash();
}

// ───────────── peek: hover a box to see what is inside ─────────────
const peekCache = new Map<string, string>();
let peekTimer = 0, peekFor = "";
board.addEventListener("pointerover", (e) => {
  // A preview on hover needs a mouse: on a touch screen the tap opens the block instead.
  if ((e as PointerEvent).pointerType !== "mouse") return;
  const b = boxFromEvent(e);
  if (!b || !b.target || b.expanded || drag?.moved) return;
  if (peekFor === b.rid) return;
  clearTimeout(peekTimer);
  const g = ridElement(e.target as Element)!;
  peekTimer = window.setTimeout(() => showPeek(b, g), 380);
});
board.addEventListener("pointerout", (e) => {
  const to = (e as PointerEvent).relatedTarget as Element | null;
  if (to && (to.closest(".peek") || ridElement(to)?.dataset.rid === peekFor)) return;
  clearTimeout(peekTimer);
  hidePeek();
});
peek.addEventListener("pointerleave", hidePeek);
function hidePeek() { peek.hidden = true; peekFor = ""; }

async function showPeek(b: Box, g: Element) {
  const key = b.target!;
  peekFor = b.rid;
  logEvent({ kind: "point", rid: b.rid });
  const head = el("div", "peek-head", el("strong", null, b.title), chip(key));
  const body: HTMLElement[] = [];
  const sum = summaryOf(key);
  if (sum) body.push(el("p", null, sum.length > 240 ? `${sum.slice(0, 237)}…` : sum));
  const mini = el("div", "peek-mini");
  if (hasDiagram(key)) { mini.append(el("span", "muted", "…")); body.push(mini); }
  const actions = el("div", "peek-actions");
  if (openable(key)) actions.append(button(hasDiagram(key) ? "Open ↘" : "Show", "btn small primary", () => { hidePeek(); openKey(key); }));
  actions.append(el("span", "muted hint", "or click the box"));
  peek.replaceChildren(head, ...body, actions);
  peek.hidden = false;
  placePeek(g);
  if (hasDiagram(key)) {
    try {
      let svg = peekCache.get(key);
      if (!svg) { svg = await render(assemble(key, new Set(), { mini: true }).text); peekCache.set(key, svg); }
      if (peekFor !== b.rid) return;
      mini.innerHTML = svg; // Mermaid output
      const s = mini.querySelector("svg");
      if (s) chromeMetal(s as SVGSVGElement);
      if (s) { s.removeAttribute("width"); s.removeAttribute("height"); s.style.maxWidth = "100%"; s.style.maxHeight = "220px"; }
      placePeek(g);
    } catch { mini.replaceChildren(el("span", "muted", "(preview failed)")); }
  }
}
function placePeek(g: Element) {
  const r = g.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  const w = peek.offsetWidth, h = peek.offsetHeight;
  let x = r.right - c.left + 12, y = r.top - c.top;
  if (x + w > c.width - 8) x = r.left - c.left - w - 12;
  if (x < 8) x = Math.max(8, Math.min(c.width - w - 8, r.left - c.left));
  if (y + h > c.height - 8) y = Math.max(8, c.height - h - 8);
  peek.style.left = `${x}px`;
  peek.style.top = `${Math.max(8, y)}px`;
}

// ───────────── breadcrumbs ─────────────
function drawCrumbs() {
  crumbsEl.replaceChildren(...stack.map((v, i) => {
    const last = i === stack.length - 1;
    const li = el("li", last ? "here" : null);
    if (last) li.append(el("span", null, titleOf(v.key)));
    else li.append(button(titleOf(v.key), "crumb", () => { stack = stack.slice(0, i + 1); selected = null; syncHash(); draw(); }));
    return li;
  }));
  const up = document.getElementById("back") as HTMLButtonElement;
  up.disabled = stack.length < 2;
  up.textContent = stack.length > 1 ? `↑ Up to ${titleOf(stack[stack.length - 2].key)}` : "↑ Up";
}

// ───────────── the details panel ─────────────
function chip(key: string): HTMLElement {
  const st = statusOf(key);
  const k = kindOf(key);
  const label = st ?? (k === "fn" ? "function" : k === "file" ? (SITE.files[key]?.lang === "other" ? "file" : "code") : k === "adr" ? "decision" : k === "part" ? "group" : "");
  return el("span", `chip chip-${st ?? k}`, label);
}
function summaryOf(key: string): string {
  const k = kindOf(key);
  if (k === "node") return SITE.nodes[key.slice(5)]?.summary ?? "";
  if (k === "file") return SITE.files[key]?.doc ?? "";
  if (k === "fn") return SITE.fns[key]?.doc ?? "";
  if (k === "part") { const p = SITE.parts?.[key]; return p ? `${p.functions.length} functions of ${titleOf(p.file)}. ${p.note}` : ""; }
  if (k === "adr") { const a = adrOf(key); return a ? `${a.title}. ${a.status}` : ""; }
  return "";
}
function link(label: string, key: string, cls = "a"): HTMLElement {
  const b = button(label, cls, () => (hasDiagram(key) ? openKey(key) : select(key)));
  if (!openable(key)) b.disabled = true;
  return b;
}
/** "Open on GitLab ↗" for a repo's source link; a private remote says so, since many readers cannot open it. */
function sourceLink(repo: string, href: string): HTMLElement {
  const r = SITE.meta.repos[repo];
  const p = el("p", null, ext(`Open on ${r?.host ?? "the repo host"} ↗`, href));
  if (r?.restricted) p.append(el("span", "muted small", " 🔒 private repo: needs access"));
  return p;
}
function ext(label: string, href: string): HTMLElement {
  const a = el("a", "ext", label) as HTMLAnchorElement;
  a.href = href; a.target = "_blank"; a.rel = "noopener";
  return a;
}
function select(key: string) { selected = key; drawPanel(); }

function drawPanel() {
  const key = selected ?? view().key;
  const parts: (HTMLElement | null)[] = [];
  const k = kindOf(key);
  const isView = !selected;
  const top = el("div", "panel-top", el("span", "eyebrow", isView ? "You are looking at" : "Selected"), chip(key), button("⟩", "btn icon small panel-hide", () => setPanel(false), "Hide the details panel (\\)"));
  parts.push(top);
  if (k === "box") parts.push(el("h2", null, key.slice(4)), el("p", "muted", "A plain box: nothing is linked to it yet. Add a node with this id, or a %% @link line, to make it a block."));
  if (k === "node") parts.push(...nodePanel(SITE.nodes[key.slice(5)], isView));
  if (k === "file") parts.push(...filePanel(SITE.files[key]));
  if (k === "fn") parts.push(...fnPanel(SITE.fns[key]));
  if (k === "part" && SITE.parts?.[key]) parts.push(...partPanel(SITE.parts[key]));
  if (k === "adr") parts.push(...adrPanel(adrOf(key)));
  if (!isView) parts.push(el("div", "panel-actions", button(`Back to ${titleOf(view().key)}`, "btn", () => { selected = null; selectedRid = null; drawPanel(); markSelected(); })));
  if (isView && stack.length === 1 && k === "node") parts.push(intro());
  panel.replaceChildren(...parts.filter(Boolean) as HTMLElement[]);
  (document.getElementById("main") as HTMLElement).classList.toggle("code-view", k === "fn");
  panel.scrollTop = 0;
}

/** A group of a big file's functions: what the group is, and its functions as links. */
function partPanel(p: Site["parts"][string]): HTMLElement[] {
  return [
    el("h2", null, p.title),
    el("p", "muted", `${p.functions.length} functions of `, link(titleOf(p.file), p.file, "a mono"), `. ${p.note}`),
    el("p", "muted small", "Big files are drawn as groups so the lines stay readable. Calls to helpers used all over the file are not drawn; each function's own page lists every call."),
    el("h3", null, "Functions"),
    el("ul", "anchors cols", ...p.functions.map((k) => el("li", null, link(titleOf(k), k, "a mono")))),
  ];
}

function intro(): HTMLElement {
  const box = el("details", "intro",
    el("summary", null, el("h3", null, "How to explore")),
    el("ul", null,
      el("li", null, el("strong", null, touchy ? "Tap" : "Click"), " a box with the ", el("i", "sw sw-drill"), " badge to open it. Keep going down to files, functions and their source."),
      touchy ? null : el("li", null, el("strong", null, "Hover"), " a box to peek inside before you open it."),
      touchy ? el("li", null, el("strong", null, "↑ Up"), " or the breadcrumbs take you back up.") : el("li", null, el("strong", null, "↑ Up"), " (top left), the breadcrumbs, ", el("kbd", null, "Esc"), " or ", el("kbd", null, "Backspace"), " take you back up."),
      el("li", null, el("strong", null, "Tours"), " (top right) follow one piece of data through the system, with branches."),
      touchy ? el("li", null, "Drag to pan, pinch to zoom.") : el("li", null, "Drag to pan, scroll to zoom, ", el("kbd", null, "/"), " to search. ", el("kbd", null, "\\"), " hides this panel.")),
    meta()) as HTMLDetailsElement;
  box.open = pref("fraktul-intro", "1") === "1";
  box.addEventListener("toggle", () => savePref("fraktul-intro", box.open ? "1" : "0"));
  return box;
}
function pref(k: string, d: string) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function savePref(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private window */ } }
function meta(): HTMLElement {
  const m = SITE.meta;
  const missing = Object.entries(m.repos).filter(([, r]) => !r.present).map(([k]) => k);
  return el("p", "muted small", `Built ${m.built.slice(0, 16).replace("T", " ")} UTC from ${m.repos[m.defaultRepo]?.title ?? m.defaultRepo} ${m.commit ? m.commit.slice(0, 7) : ""} with fraktul. Diagrams come from the model file; file and function levels are generated from the code.${missing.length ? ` Not on the build machine: ${missing.join(", ")}.` : ""}`);
}

function nodePanel(n: NodeInfo, isView: boolean): HTMLElement[] {
  const out: HTMLElement[] = [el("h2", null, n.title)];
  if (n.summary) out.push(el("p", "summary", n.summary));
  for (const l of n.live ?? []) { const b = liveBlock(l); if (b) out.push(b); }
  const groups: [string, string][] = [["functions", "Functions"], ["files", "Code"], ["data", "Data"], ["docs", "Docs"], ["adrs", "Decisions (ADRs)"]];
  for (const [kind, label] of groups) {
    const items = n.anchors.filter((a) => a.kind === kind);
    if (!items.length) continue;
    out.push(el("h3", null, label), el("ul", "anchors", ...items.map((a) => el("li", a.missing ? "missing" : null, link(a.label, a.key), a.missing ? el("span", "muted", " (not on this machine)") : null))));
  }
  if (!isView && n.usedIn.length) out.push(el("h3", null, "Appears in"), el("ul", "anchors", ...n.usedIn.map((u) => el("li", null, button(SITE.nodes[u].title, "a", () => goTo(u))))));
  if (isView && stack.length > 1) {
    const d = SITE.diagrams[view().key];
    const kids = d.ids.map((i) => d.targets[i]).filter((t) => t && kindOf(t) === "node") as string[];
    if (kids.length) out.push(el("h3", null, "Blocks in this diagram"), el("ul", "anchors", ...kids.map((t) => el("li", null, link(titleOf(t), t), " ", chip(t)))));
  }
  return out;
}

function filePanel(f: FileInfo): HTMLElement[] {
  const repo = SITE.meta.repos[f.repo];
  const out: HTMLElement[] = [el("h2", "mono", f.path), el("p", "muted", `${repo?.title ?? f.repo}${f.lines ? ` · ${f.lines} lines` : ""}${f.lang !== "other" ? ` · ${f.functions.length} functions` : ""}`)];
  if (!f.exists) out.push(el("p", "muted", SITE.meta.repos[f.repo]?.present ? "Listed by name only (this folder is kept private)." : "This repo was not on the machine that built the site."));
  if (f.doc) out.push(el("p", "summary", f.doc));
  if (f.url) out.push(sourceLink(f.repo, f.url));
  if (f.functions.length) out.push(el("h3", null, "Functions"), el("ul", "anchors cols", ...f.functions.map((n) => el("li", null, link(`${n}()`, `${f.key.replace(/^file:/, "fn:")}#${n}`, "a mono")))));
  if (f.imports.length) out.push(el("h3", null, "Imports"), el("ul", "anchors", ...f.imports.map((i) => el("li", null, link(SITE.files[i]?.path ?? i, i, "a mono")))));
  if (f.importedBy.length) out.push(el("h3", null, "Imported by"), el("ul", "anchors", ...f.importedBy.map((i) => el("li", null, link(SITE.files[i]?.path ?? i, i, "a mono")))));
  if (f.excerpt) out.push(el("h3", null, "First lines"), el("pre", "code", f.excerpt));
  return out;
}

function fnPanel(f: FnInfo): HTMLElement[] {
  const file = SITE.files[f.file];
  const out: HTMLElement[] = [el("h2", "mono", `${f.name}(${f.params.length > 60 ? "…" : f.params})`)];
  out.push(el("p", "muted", link(`${file.path}`, f.file, "a mono"), ` · lines ${f.line}–${f.end}${f.exported ? " · exported" : ""}`));
  if (f.doc) out.push(el("p", "summary", f.doc));
  if (f.url) out.push(sourceLink(file.repo, f.url));
  if (f.calls.length) out.push(el("h3", null, "Calls"), el("ul", "anchors cols", ...f.calls.map((c) => el("li", null, link(`${SITE.fns[c].name}()`, c, "a mono")))));
  if (f.calledBy.length) out.push(el("h3", null, "Called by"), el("ul", "anchors cols", ...f.calledBy.map((c) => el("li", null, link(`${SITE.fns[c].name}()`, c, "a mono")))));
  out.push(el("h3", null, "Source"), f.code ? codeView(f) : el("p", "muted", "Source is not included in this public copy of the map."));
  return out;
}

/** Source with line numbers; every function it calls is a link into that function. */
function codeView(f: FnInfo): HTMLElement {
  const callees = new Map(f.calls.map((c) => [SITE.fns[c].name, c]));
  const pre = el("pre", "code numbered");
  const re = callees.size ? new RegExp(`\\b(${[...callees.keys()].map((n) => n.replace(/[$]/g, "\\$")).join("|")})(?=\\s*\\()`, "g") : null;
  f.code.split("\n").forEach((line, i) => {
    const row = el("span", "ln");
    row.dataset.n = String(f.line + i);
    if (!re) row.append(line);
    else {
      let last = 0;
      for (const m of line.matchAll(re)) {
        row.append(line.slice(last, m.index));
        row.append(button(m[0], "call", () => openKey(callees.get(m[0])!), `Open ${m[0]}()`));
        last = (m.index ?? 0) + m[0].length;
      }
      row.append(line.slice(last));
    }
    pre.append(row, "\n");
  });
  return pre;
}

function adrPanel(a: any): HTMLElement[] {
  if (!a) return [el("p", null, "This ADR is not in docs/adr/.")];
  const out: HTMLElement[] = [el("h2", null, `ADR ${a.num}: ${a.title}`)];
  out.push(el("p", "muted mono", a.file));
  if (a.url) out.push(sourceLink(SITE.meta.defaultRepo, a.url));
  out.push(markdown(a.text.replace(/^#.*\n/, "")));
  const users = Object.values(SITE.nodes).filter((n) => n.anchors.some((x) => x.key === `adr:${a.num}`));
  if (users.length) out.push(el("h3", null, "Where it applies"), el("ul", "anchors", ...users.map((n) => el("li", null, button(n.title, "a", () => goTo(n.id))))));
  return out;
}

/** Just enough Markdown for ADRs: headings, bullets (with continuation lines), paragraphs, `code` and **bold**. */
function markdown(src: string): HTMLElement {
  const root = el("div", "md");
  const inline = (s: string) => {
    const span = el("span");
    for (const part of s.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) span.append(el("code", null, part.slice(1, -1)));
      else if (part.startsWith("**") && part.endsWith("**")) span.append(el("strong", null, part.slice(2, -2)));
      else span.append(part);
    }
    return span;
  };
  let list: HTMLElement | null = null, item: string | null = null, para: string[] = [];
  const flushItem = () => { if (item !== null && list) list.append(el("li", null, inline(item))); item = null; };
  const flushPara = () => { if (para.length) root.append(el("p", null, inline(para.join(" ")))); para = []; };
  for (const raw of src.split("\n")) {
    const l = raw.trimEnd();
    const h = l.match(/^(#{1,4})\s+(.*)/);
    const b = l.match(/^\s*[-*]\s+(.*)/);
    if (h) { flushItem(); flushPara(); list = null; root.append(el("h4", null, h[2])); }
    else if (b) { flushPara(); if (!list) { list = el("ul"); root.append(list); } flushItem(); item = b[1]; }
    else if (!l.trim()) { flushItem(); flushPara(); list = null; }
    else if (item !== null) item += " " + l.trim();
    else para.push(l.trim());
  }
  flushItem(); flushPara();
  return root;
}

// Facts read from the project at build time (src/lib/live.ts): rows, a stacked bar, a list, groups.
function liveBlock(name: string): HTMLElement | null {
  const b = SITE.live.blocks?.[name];
  if (!b) return null;
  const box = el("div", "live", el("div", "live-head", b.title));
  if (b.bar?.length) {
    box.append(el("div", "runbar", ...b.bar.map((x: any) => { const s = el("span", `seg seg-${x.tone ?? "neutral"}`); s.style.flexGrow = String(x.value); s.title = `${x.label}: ${x.value}`; return s; })));
  }
  if (b.rows?.length) box.append(el("table", "facts", ...b.rows.map((r: any[]) => el("tr", null, el("th", null, String(r[0])), el("td", null, String(r[1]))))));
  if (b.text) box.append(el("p", "small", b.text));
  if (b.list?.length) {
    const ul = el("ul", "anchors small-list", ...b.list.map((x: any) => el("li", null, x.key ? link(x.label, x.key) : x.label, x.note ? el("span", "muted small", ` ${x.note}`) : null)));
    box.append(b.fold ? el("details", null, el("summary", null, "All"), ul) : ul);
  }
  if (b.groups?.length) box.append(el("ol", "wf", ...b.groups.map((g: any) => el("li", null, el("strong", null, g.label), g.note ? el("span", "muted small", ` ${g.note}`) : null, el("ul", null, ...g.items.map((i: string) => el("li", "small", i)))))));
  if (b.source) box.append(el("p", "muted small mono", b.source));
  return box;
}

// ───────────── tours ─────────────
// A tour is a path through the map: each step shows one diagram with some boxes highlighted. With narration rendered
// (fraktul voice), "Listen" speaks each step; the narration's cues move the highlight while it talks, then the tour
// moves on by itself. Recorded walkthroughs (a person talking while clicking) replay the same way.
type Narration = { file: string; duration: number; cues: { t: number; focus: string[] }[]; captions: { t: number; end: number; text: string }[] };
const audio = new Audio();
audio.preload = "auto";
let autoTimer = 0;
const narrationOf = (t: Tour, s: Step): Narration | null => (SITE as any).voice?.[t.id]?.steps?.[s.id] ?? null;
const voiced = (t: Tour) => t.steps.some((s) => narrationOf(t, s));
const tourMinutes = (t: Tour) => Math.max(1, Math.round(t.steps.reduce((n, s) => n + (narrationOf(t, s)?.duration ?? 0), 0) / 60));
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function drawTourList() {
  const recs: any[] = (SITE as any).recordings ?? [];
  const list = document.getElementById("tour-list") as HTMLElement;
  list.replaceChildren(...SITE.tours.map((t) => el("li", null,
    el("h3", null, t.title), el("p", null, t.summary),
    el("p", "muted small", `${t.steps.length} stops${t.steps.some((s) => s.branches?.length) ? ", with branches" : ""}${voiced(t) ? ` · narrated, about ${tourMinutes(t)} min` : ""}`),
    el("div", "tour-buttons",
      voiced(t) ? button("▶ Listen", "btn primary", () => { toursDlg.close(); startTour(t.id, undefined, true); }) : null,
      button(voiced(t) ? "Read" : "Start →", voiced(t) ? "btn" : "btn primary", () => { toursDlg.close(); startTour(t.id); })))),
    ...recs.map((r) => el("li", "rec-item",
      el("span", "eyebrow", "Recorded walkthrough"), el("h3", null, r.title), r.summary ? el("p", null, r.summary) : null,
      el("p", "muted small", `${r.by ? `${r.by} · ` : ""}${fmt(r.duration)}${r.recorded ? ` · ${r.recorded.slice(0, 10)}` : ""}`),
      el("div", "tour-buttons", button("▶ Play", "btn primary", () => { toursDlg.close(); playRecording(r); })))));
  const rec = document.getElementById("rec-start") as HTMLButtonElement;
  rec.hidden = !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined";
}
const findStep = (id: string) => { for (const t of SITE.tours) { const s = t.steps.find((x) => x.id === id); if (s) return { t, s }; } return null; };
function startTour(id: string, stepId?: string, listen = false) {
  stopReplay();
  const t = SITE.tours.find((x) => x.id === id)!;
  tour = { t, step: stepId ? t.steps.find((s) => s.id === stepId)! : t.steps[0], trail: [], listen } as any;
  showStep();
}
function nextOf(): string | null {
  if (!tour) return null;
  if (tour.step.next) return tour.step.next;
  const i = tour.t.steps.indexOf(tour.step);
  return tour.t.steps[i + 1]?.id ?? null;
}
function go(to: string) {
  if (!tour) return;
  clearTimeout(autoTimer);
  tour.trail.push(tour.step.id);
  const listen = (tour as any).listen;
  if (to.startsWith("tour:")) { const t = SITE.tours.find((x) => x.id === to.slice(5))!; tour = { t, step: t.steps[0], trail: tour.trail, listen } as any; }
  else { const f = findStep(to)!; tour = { t: f.t, step: f.s, trail: tour.trail, listen } as any; }
  showStep();
}
async function showStep() {
  if (!tour) return;
  clearTimeout(autoTimer);
  audio.pause();
  const s = tour.step;
  tourCard.hidden = false;
  tourCard.classList.remove("is-min");
  await goTo(s.view, s.expand ?? []);
  const t = tour.t;
  const n = t.steps.indexOf(s) + 1;
  const nx = nextOf();
  const nar = narrationOf(t, s);
  const listen = !!(tour as any).listen && !!nar;
  const focusBoxes = (s.focus ?? []).map((f) => f.replace("/", "__"));
  const dives = focusBoxes.map((r) => current.boxes.get(r)).filter((b): b is Box => !!b && !!b.target && hasDiagram(b.target!) && kindOf(b.target!) === "node");
  const caption = el("p", "caption");
  tourCard.replaceChildren(...[
    el("div", "tour-head", el("span", "eyebrow", `${t.title} · ${n} of ${t.steps.length}`), button("Back to the tour", "btn small resume", () => (view().key === `node:${tour!.step.view}` ? toggleCardMin() : showStep())), button("", "btn icon card-min", toggleCardMin, "Fold the tour card to its title bar (the voice keeps going)"), button("×", "btn icon", endTour, "End the tour")),
    el("h3", null, s.title),
    el("p", null, s.text),
    listen ? player(nar!, caption) : nar ? el("div", "listen-row", button("▶ Listen", "btn small primary", () => { (tour as any).listen = true; showStep(); }), el("span", "muted small", `${fmt(nar.duration)} narrated`)) : null,
    listen ? caption : null,
    s.branches?.length ? el("div", "branches", el("span", "eyebrow", "Or branch"), ...s.branches.map((b) => button(`${b.label} →`, "btn branch", () => go(b.to)))) : null,
    dives.length ? el("div", "dives", el("span", "eyebrow", "Dive in"), ...dives.slice(0, 4).map((b) => button(`${b.title} ↘`, "btn small", () => { audio.pause(); tourCard.classList.add("is-min"); openKey(b.target!); }))) : null,
    el("div", "tour-nav",
      button("← Back", "btn", () => { const p = tour!.trail.pop(); if (p) { const f = findStep(p)!; tour = { t: f.t, step: f.s, trail: tour!.trail, listen: (tour as any).listen } as any; showStep(); } }),
      nx ? button("Next →", "btn primary", () => go(nx)) : button("Finish", "btn primary", endTour)),
  ].filter((x): x is HTMLElement => !!x));
  ((tourCard.querySelector(".tour-nav") as HTMLElement).firstChild as HTMLButtonElement).disabled = !tour.trail.length;
  if (listen) {
    audio.src = nar!.file;
    audio.currentTime = 0;
    audio.play().catch(() => { /* the browser wants a click first: the play button is there */ });
  }
}

/** Play / pause, a seekable bar, time and speed; captions and cues follow the audio. */
let playerBits: { btn: HTMLButtonElement; fill: HTMLElement; time: HTMLElement; caption: HTMLElement; nar: Narration } | null = null;
let speed = 1;
function player(nar: Narration, caption: HTMLElement): HTMLElement {
  const btn = button("❚❚", "btn small play", () => (audio.paused ? audio.play() : audio.pause()), "Play or pause (Space)");
  const fill = el("span", "fill");
  const bar = el("div", "progress", fill);
  bar.addEventListener("click", (e) => { const r = bar.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * (audio.duration || nar.duration); });
  const time = el("span", "muted small mono", `0:00 / ${fmt(nar.duration)}`);
  const sp = button(`${speed}×`, "btn small", () => { speed = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 0.85 : 1; audio.playbackRate = speed; sp.textContent = `${speed}×`; }, "Speed");
  audio.playbackRate = speed;
  playerBits = { btn, fill, time, caption, nar };
  return el("div", "player", btn, bar, time, sp);
}
function setFocus(list: string[]) {
  current.svg?.querySelectorAll(".is-focus").forEach((x) => x.classList.remove("is-focus"));
  for (const f of list) current.els.get(f.replace("/", "__"))?.classList.add("is-focus");
  if (in3d) {
    const rids = list.map((f) => f.replace("/", "__"));
    F3D.focus(rids);
    // Fly the camera only when what the narration points at changes (timeupdate calls this several times a second).
    const key = `${view().key}|${rids.join(",")}`;
    if (key !== flownTo) {
      flownTo = key;
      // With nothing named, look at the whole level; during a tour, circle slowly while the voice talks.
      F3D.flyTo(rids.length ? rids : [...current.boxes.keys()], { orbit: !!tour });
    }
  }
}
let flownTo = "";
audio.addEventListener("play", () => { if (playerBits) playerBits.btn.textContent = "❚❚"; });
audio.addEventListener("pause", () => { if (playerBits) playerBits.btn.textContent = "▶"; });
audio.addEventListener("timeupdate", () => {
  if (replay) { replayTick(); return; }
  if (!playerBits || !tour) return;
  const t = audio.currentTime, nar = playerBits.nar;
  playerBits.fill.style.width = `${Math.min(100, (100 * t) / (audio.duration || nar.duration))}%`;
  playerBits.time.textContent = `${fmt(t)} / ${fmt(nar.duration)}`;
  const cue = [...nar.cues].reverse().find((c) => c.t <= t + 0.05);
  if (view().key === `node:${tour.step.view}`) setFocus(cue ? cue.focus : tour.step.focus ?? []);
  const cap = nar.captions.find((c) => t >= c.t && t < c.end + 0.3);
  playerBits.caption.textContent = cap ? cap.text : "";
});
audio.addEventListener("ended", () => {
  if (replay) { stopReplay(); return; }
  if (!tour || !(tour as any).listen) return;
  const nx = nextOf();
  if (!nx) { playerBits!.caption.textContent = "End of the tour."; return; }
  const wait = tour.step.branches?.length ? 6000 : 1500;
  if (tour.step.branches?.length) playerBits!.caption.textContent = "Pick a branch, or the tour carries on in a few seconds.";
  autoTimer = window.setTimeout(() => go(nx), wait);
});

function endTour() {
  clearTimeout(autoTimer); audio.pause(); tour = null; tourCard.hidden = true; applyTourFocus(); syncHash();
  // Pull the camera back to see the whole level again.
  if (in3d) F3D.flyTo([...current.boxes.keys()]);
}
function applyTourFocus() {
  const svg = current.svg;
  if (!svg) return;
  if (replay) return;
  svg.classList.toggle("in-tour", !!tour && view().key === `node:${tour.step.view}`);
  svg.querySelectorAll(".is-focus").forEach((x) => x.classList.remove("is-focus"));
  if (in3d) { F3D.focus([]); F3D.stopOrbit(); flownTo = ""; }
  if (!tour || view().key !== `node:${tour.step.view}`) { if (tour) tourCard.classList.add("is-min"); return; }
  tourCard.classList.remove("is-min");
  setFocus(tour.step.focus ?? []);
}

// ───────────── recorded walkthroughs: record (mic + clicks) and replay ─────────────
type RecEvent = { t: number; kind: "view"; stack: View[] } | { t: number; kind: "point"; rid: string | null } | { t: number; kind: "select"; key: string | null };
let recording: { mr: MediaRecorder; chunks: Blob[]; t0: number; events: RecEvent[]; timer: number; mime: string } | null = null;
let replay: { rec: any; next: number; drawing: boolean } | null = null;
let lastBlob: { blob: Blob; mime: string; events: RecEvent[]; duration: number } | null = null;
const recBar = document.getElementById("rec-bar") as HTMLElement;
const saveDlg = document.getElementById("rec-save") as HTMLDialogElement;
const now = () => (recording ? (performance.now() - recording.t0) / 1000 : 0);
function logEvent(e: any) { if (recording) recording.events.push({ ...e, t: Number(now().toFixed(2)) }); }

async function startRecording() {
  toursDlg.close();
  endTour();
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { alertBox("The microphone is not available here. Recording works in the local map (fraktul dev) after you allow the microphone."); return; }
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recording = { mr, chunks: [], t0: performance.now(), events: [], timer: 0, mime: mr.mimeType || mime };
  mr.ondataavailable = (e) => { if (e.data.size) recording?.chunks.push(e.data); };
  mr.start(1000);
  logEvent({ kind: "view", stack: JSON.parse(JSON.stringify(stack)) });
  recBar.hidden = false;
  const clock = document.getElementById("rec-time") as HTMLElement;
  recording.timer = window.setInterval(() => { clock.textContent = fmt(now()); }, 250);
}
function stopRecording() {
  if (!recording) return;
  const r = recording;
  const duration = now();
  r.mr.onstop = () => {
    r.mr.stream.getTracks().forEach((t) => t.stop());
    lastBlob = { blob: new Blob(r.chunks, { type: r.mime }), mime: r.mime, events: r.events, duration };
    (document.getElementById("rec-len") as HTMLElement).textContent = fmt(duration);
    saveDlg.showModal();
  };
  r.mr.stop();
  clearInterval(r.timer);
  recording = null;
  recBar.hidden = true;
}
function alertBox(msg: string) {
  panel.prepend(el("div", "notice", msg));
}
async function saveRecording() {
  if (!lastBlob) return;
  const title = ((document.getElementById("rec-title") as HTMLInputElement).value || "Walkthrough").trim();
  const summary = (document.getElementById("rec-summary") as HTMLInputElement).value.trim();
  const by = (document.getElementById("rec-by") as HTMLInputElement).value.trim();
  const buf = new Uint8Array(await lastBlob.blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const id = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}`;
  const rec = { id, title, summary, by, recorded: new Date().toISOString(), duration: Number(lastBlob.duration.toFixed(1)), mime: lastBlob.mime, events: lastBlob.events, audio: btoa(bin) };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: "application/json" }));
  a.download = `${id}.json`;
  a.click();
  const done = document.getElementById("rec-done") as HTMLElement;
  done.hidden = false;
  done.textContent = `Saved ${id}.json to your downloads. Add it to the map: fraktul import-recording ~/Downloads/${id}.json, then rebuild.`;
}
function previewRecording() {
  if (!lastBlob) return;
  saveDlg.close();
  playRecording({ title: "Your recording (not saved yet)", duration: lastBlob.duration, events: lastBlob.events, url: URL.createObjectURL(lastBlob.blob) });
}

function playRecording(rec: any) {
  endTour();
  replay = { rec, next: 0, drawing: false };
  const fill = el("span", "fill");
  const bar = el("div", "progress", fill);
  const time = el("span", "muted small mono", `0:00 / ${fmt(rec.duration)}`);
  const btn = button("❚❚", "btn small play", () => (audio.paused ? audio.play() : audio.pause()));
  bar.addEventListener("click", (e) => { const r = bar.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * (audio.duration || rec.duration); replay!.next = 0; });
  playerBits = { btn, fill, time, caption: el("p"), nar: { file: "", duration: rec.duration, cues: [], captions: [] } };
  tourCard.replaceChildren(
    el("div", "tour-head", el("span", "eyebrow", "Recorded walkthrough"), button("", "btn icon card-min", toggleCardMin, "Fold the card to its title bar"), button("×", "btn icon", stopReplay, "Stop")),
    el("h3", null, rec.title), rec.summary ? el("p", null, rec.summary) : el("span"),
    el("div", "player", btn, bar, time));
  tourCard.hidden = false;
  tourCard.classList.remove("is-min");
  audio.src = rec.url ?? rec.file;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
async function replayTick() {
  if (!replay || replay.drawing) return;
  const t = audio.currentTime, rec = replay.rec;
  if (playerBits) { playerBits.fill.style.width = `${Math.min(100, (100 * t) / rec.duration)}%`; playerBits.time.textContent = `${fmt(t)} / ${fmt(rec.duration)}`; }
  // Apply every event up to now (from the start after a seek back).
  const due: RecEvent[] = [];
  while (replay.next < rec.events.length && rec.events[replay.next].t <= t) due.push(rec.events[replay.next++]);
  if (!due.length) return;
  const lastView = [...due].reverse().find((e) => e.kind === "view") as any;
  if (lastView) {
    replay.drawing = true;
    stack = lastView.stack.map((v: View) => ({ key: v.key, expanded: [...v.expanded] }));
    selected = null;
    await draw();
    if (replay) replay.drawing = false;
  }
  const after = lastView ? due.slice(due.indexOf(lastView) + 1) : due;
  for (const e of after as any[]) {
    if (e.kind === "point") { current.svg?.querySelectorAll(".is-point").forEach((x) => x.classList.remove("is-point")); if (e.rid) current.els.get(e.rid)?.classList.add("is-point"); }
    if (e.kind === "select") { selected = e.key; drawPanel(); }
  }
}
function stopReplay() {
  if (!replay) return;
  replay = null;
  audio.pause();
  tourCard.hidden = true;
  current.svg?.querySelectorAll(".is-point").forEach((x) => x.classList.remove("is-point"));
}
(document.getElementById("rec-start") as HTMLElement).addEventListener("click", startRecording);
(document.getElementById("rec-stop") as HTMLElement).addEventListener("click", stopRecording);
(document.getElementById("rec-save-btn") as HTMLElement).addEventListener("click", saveRecording);
(document.getElementById("rec-preview") as HTMLElement).addEventListener("click", previewRecording);
(document.getElementById("rec-discard") as HTMLElement).addEventListener("click", () => { lastBlob = null; saveDlg.close(); });

(document.getElementById("tours-btn") as HTMLElement).addEventListener("click", () => { drawTourList(); toursDlg.showModal(); });
(document.getElementById("tours-close") as HTMLElement).addEventListener("click", () => toursDlg.close());
toursDlg.addEventListener("click", (e) => { if (e.target === toursDlg) toursDlg.close(); });

// ───────────── search ─────────────
type Hit = { key: string; label: string; sub: string; score: number };
let hits: Hit[] = [], hitIndex = 0;
function find(qs: string): Hit[] {
  const q = qs.trim().toLowerCase();
  if (!q) return [];
  const out: Hit[] = [];
  const score = (s: string) => { const i = s.toLowerCase().indexOf(q); return i < 0 ? -1 : i === 0 ? 3 : 1; };
  for (const n of Object.values(SITE.nodes)) { const sc = Math.max(score(n.title) * 2, score(n.id), n.summary && n.summary.toLowerCase().includes(q) ? 0.5 : -1); if (sc >= 0) out.push({ key: `node:${n.id}`, label: n.title, sub: n.status ?? "", score: sc + 1 }); }
  for (const f of Object.values(SITE.files)) { const sc = score(f.path); if (sc >= 0) out.push({ key: f.key, label: f.path, sub: SITE.meta.repos[f.repo]?.title ?? f.repo, score: sc }); }
  for (const f of Object.values(SITE.fns)) { const sc = score(f.name); if (sc >= 0) out.push({ key: f.key, label: `${f.name}()`, sub: SITE.files[f.file]?.path ?? "", score: sc + (f.exported ? 0.3 : 0) }); }
  for (const a of SITE.live.adrs) { const sc = Math.max(score(a.title), score(a.num)); if (sc >= 0) out.push({ key: `adr:${a.num}`, label: `ADR ${a.num}: ${a.title}`, sub: "decision", score: sc }); }
  return out.sort((a, b) => b.score - a.score || a.label.length - b.label.length).slice(0, 14);
}
function drawHits() {
  results.hidden = !hits.length;
  results.replaceChildren(...hits.map((h, i) => {
    const li = el("li", i === hitIndex ? "on" : null, el("span", null, h.label), el("span", "muted small", h.sub));
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(h); });
    return li;
  }));
}
function pick(h: Hit) {
  hits = []; drawHits(); search.value = ""; search.blur();
  if (kindOf(h.key) === "node") goTo(h.key.slice(5)); else openKey(h.key);
}
search.addEventListener("input", () => { hits = find(search.value); hitIndex = 0; drawHits(); });
search.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { hitIndex = Math.min(hits.length - 1, hitIndex + 1); drawHits(); e.preventDefault(); }
  if (e.key === "ArrowUp") { hitIndex = Math.max(0, hitIndex - 1); drawHits(); e.preventDefault(); }
  if (e.key === "Enter" && hits[hitIndex]) pick(hits[hitIndex]);
  if (e.key === "Escape") { hits = []; drawHits(); search.blur(); }
});
search.addEventListener("blur", () => setTimeout(() => { hits = []; drawHits(); }, 120));

// ───────────── 3D: the same level as a place to fly through (map3d.ts, docs/3d-view.md) ─────────────
type Family = "database" | "server" | "screen" | "terminal" | "gear" | "neural" | "document" | "person" | "cloud" | "diamond" | "package" | "folder" | "disk" | "queue" | "tablet" | "terrain" | "plain";
const F3D = (window as any).Fraktul3D;
const space = document.getElementById("space") as HTMLElement;
const btn3d = document.getElementById("view-3d") as HTMLButtonElement;
// The flat map is the default; 3D is on when the link says so (?view=3d) or the reader switches it on.
let in3d = false, entry3d = false, want3d = false;

/** FNV-1a: a block's identity in 3D (crown, setbacks, windows) comes from its id, so it survives code changes. */
function fnv(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const CATS = ["model", "code", "human", "data", "ext", "fn", "fnx", "file", "district"];
// 3D draws each box as what it is: a database as stacked disks, an API as a server rack, a page as a screen, a
// function as a gear, a model as a small neural net, a person as a figure, an outside service as a cloud. The words in
// a box's title win (they say what it is), then its Mermaid shape, then the block's kind, then its colour class.
const WORD_SHAPE: [RegExp, Family][] = [
  [/\b(db|database|sql|postgres|mysql|sqlite|mongo|table|tables|index|warehouse|store|cache|redis|ledger)\b/i, "database"],
  [/\b(disk|disks|storage|bucket|blob|s3|volume|drive|archive|backup|filesystem)\b/i, "disk"],
  [/\b(queue|stream|topic|bus|kafka|events?|inbox|outbox|webhook)\b/i, "queue"],
  [/\b(api|apis|endpoint|server|service|backend|gateway|worker|function app|lambda|host)\b/i, "server"],
  [/\b(cli|terminal|shell|command|script|cron|job)\b/i, "terminal"],
  [/\b(page|ui|screen|app|browser|dashboard|site|web|frontend|portal|view|teams|chat|3d|panel|board)\b/i, "screen"],
  [/\b(file|files|doc|docs|document|pdf|yaml|json|csv|mp3|report|readme|manual|deck|spec|html)\b/i, "document"],
  [/\b(model|llm|ai|gpt|claude|neural|embedding|embeddings|kokoro|classifier|agent|voice)\b/i, "neural"],
  [/\b(algorithm|parse|parser|split|sort|rank|match|compute|check|checks|rule|rules|engine|calc|transform|build|generate|reader?)\b/i, "gear"],
  [/\b(repo|repos|repository|git|github|folder)\b/i, "folder"],
  [/\b(user|users|customer|person|people|you|someone|staff|coder|reviewer|team|author|reader|expert)\b/i, "person"],
];
const KIND_SHAPE: Record<string, Family> = { district: "terrain", component: "package", module: "package", data: "database", person: "person", service: "server", repo: "folder", doc: "document", step: "gear" };
const CLASS_SHAPE: Record<string, Family> = { human: "person", data: "database", ext: "cloud", model: "neural", code: "package", file: "document", fn: "gear", fnx: "gear", district: "terrain" };
const SHAPE_TONE: Partial<Record<Family, string>> = { person: "human", database: "data", disk: "data", queue: "data", cloud: "ext", document: "file", gear: "fn", terrain: "district", neural: "model", tablet: "plain", server: "code", screen: "code", terminal: "code", package: "code", folder: "file" };
/** The Mermaid shape a box was written with ("[(", "{", "([", "[[" …), from the parsed diagram. */
function mermaidShape(b: Box): string {
  const [outer, inner] = b.rid.includes("__") ? b.rid.split("__") : [null, b.rid];
  const d = SITE.diagrams[outer ? `node:${outer}` : view().key] as any;
  for (const l of d?.lines ?? []) for (const t of l.tok ?? []) if (t.id === inner && t.shape) return t.shape;
  return "";
}
/** Lines of code behind a box: a file's lines, a function's span, or the files a block is anchored to. */
function linesOf(target: string | null): number | null {
  if (!target) return null;
  if (SITE.files[target]) return SITE.files[target].lines || null;
  if (SITE.fns[target]) return SITE.fns[target].end - SITE.fns[target].line + 1;
  const n = nodeOf(target);
  if (!n) return null;
  const sum = n.anchors.filter((a) => a.key.startsWith("file:")).reduce((t, a) => t + (SITE.files[a.key]?.lines ?? 0), 0);
  return sum || null;
}
function shapeOf(b: Box, cls: string | undefined, title: string): Family {
  const n = b.target ? nodeOf(b.target) : undefined;
  if (b.target?.startsWith("adr:")) return "tablet";
  if (b.target?.startsWith("fn:")) return "gear";
  if (b.target?.startsWith("file:")) return "document";
  if (b.target?.startsWith("part:")) return "folder";
  if (n?.status === "external" || cls === "ext") return "cloud";
  if (cls === "human") return "person";
  if (n?.kind === "district") return "terrain";
  const shape = mermaidShape(b);
  if (shape.startsWith("[(")) return /disk|storage|bucket|volume|drive/i.test(title) ? "disk" : "database";
  if (shape.startsWith("{")) return "diamond";
  if (shape.startsWith("[[")) return "gear";
  for (const [re, f] of WORD_SHAPE) if (re.test(`${title} ${b.box.replace(/_/g, " ")}`)) return f;
  if (n?.kind && KIND_SHAPE[n.kind]) return KIND_SHAPE[n.kind];
  if (cls && CLASS_SHAPE[cls]) return CLASS_SHAPE[cls];
  return b.target ? "package" : "plain";
}
/** What 3D needs from the diagram on screen: every box and arrow, placed where Mermaid drew it. */
function scene3d() {
  const svg = current.svg!;
  const toSvg = svg.getScreenCTM()!.inverse();
  const place = (g: SVGGraphicsElement) => {
    const m = toSvg.multiply(g.getScreenCTM()!), bb = g.getBBox();
    const a = new DOMPoint(bb.x, bb.y).matrixTransform(m), c = new DOMPoint(bb.x + bb.width, bb.y + bb.height).matrixTransform(m);
    return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) };
  };
  const items: any[] = [], groups: any[] = [], edges: any[] = [];
  for (const [rid, g] of current.els) {
    const b = current.boxes.get(rid);
    if (!b) continue;
    const p = place(g as SVGGraphicsElement);
    if (g.classList.contains("cluster")) { groups.push({ rid, title: b.title, ...p }); continue; }
    const cls = CATS.find((c) => g.classList.contains(c));
    const title = b.target ? b.title : (g.textContent || b.box).trim().replace(/\s+/g, " ");
    const family = shapeOf(b, cls, title);
    const st = b.target ? statusOf(b.target) : undefined;
    const lines = linesOf(b.target);
    const drill = openable(b.target) && b.target !== view().key;
    const sub = [st && st !== "built" ? st : "", lines ? `${lines.toLocaleString()} lines` : "", drill ? (touchy ? "tap to enter" : "click to enter") : ""].filter(Boolean).join(" · ");
    const tone = cls ?? SHAPE_TONE[family] ?? (b.target ? "code" : "plain");
    items.push({ rid, title, sub, family, status: st, tone, ...p, size: lines ? Math.max(0.08, Math.min(1, Math.log10(lines + 1) / 4)) : null, hash: fnv(b.target ?? rid), drill });
  }
  svg.querySelectorAll("path.flowchart-link").forEach((path) => {
    const pe = path as SVGPathElement, len = pe.getTotalLength();
    if (!len) return;
    const m = toSvg.multiply(pe.getScreenCTM()!);
    const n = Math.max(4, Math.min(24, Math.round(len / 25)));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const q = pe.getPointAtLength((len * i) / n).matrixTransform(m); pts.push([q.x, q.y]); }
    edges.push({ pts, tone: "auto" });
  });
  return { key: view().key, items, groups, edges };
}
function after3d() {
  if (want3d) { want3d = false; set3d(true); return; }
  if (in3d && F3D.shown) { F3D.build(scene3d(), { entry: entry3d }); entry3d = false; if (tour) applyTourFocus(); }
}
async function set3d(on: boolean) {
  if (on === in3d) return;
  in3d = on;
  btn3d.setAttribute("aria-pressed", String(on));
  btn3d.title = on ? "Back to the flat map (3)" : "Fly through this level in 3D (3)";
  canvas.classList.toggle("is-3d", on);
  space.hidden = !on;
  hidePeek();
  syncHash();
  if (!on) { F3D.hide(); return; }
  try {
    await F3D.show(space, {
      pick: (rid: string | null) => {
        const b = rid ? current.boxes.get(rid) ?? null : null;
        // A block that opens a level: fly into it first, then open (the next level lands with its own entry flight).
        if (b?.target && openable(b.target) && b.target !== view().key) { F3D.dive(rid, () => { entry3d = true; clickBox(b); }); return; }
        clickBox(b);
      },
      slow: (on: boolean) => slowBtn.setAttribute("aria-pressed", String(on)),
      bird: (on: boolean) => { birdBtn.setAttribute("aria-pressed", String(on)); syncHash(); },
      locked: (on: boolean) => { lockBtn.setAttribute("aria-pressed", String(on)); lockBtn.textContent = on ? "Unlock mouse (Esc)" : "Lock mouse"; },
    });
  } catch {
    space.append(el("p", "space-error", "The 3D view could not load three.js (vendor/three.module.min.js beside this page). Rebuild the map and try again."));
    return;
  }
  slowBtn.setAttribute("aria-pressed", String(F3D.slow));
  birdBtn.setAttribute("aria-pressed", String(F3D.bird));
  entry3d = true;
  if (current.svg) after3d();
}
btn3d.addEventListener("click", () => set3d(!in3d));
const lockBtn = document.getElementById("lock-btn") as HTMLButtonElement;
lockBtn.addEventListener("click", (e) => { e.stopPropagation(); F3D.lock(!F3D.locked); });
const slowBtn = document.getElementById("slow-btn") as HTMLButtonElement;
slowBtn.addEventListener("click", (e) => { e.stopPropagation(); F3D.setSlow(!F3D.slow); });
const birdBtn = document.getElementById("bird-btn") as HTMLButtonElement;
birdBtn.addEventListener("click", (e) => { e.stopPropagation(); F3D.setBird(!F3D.bird); });

// ───────────── details panel: hide and show (remembered) ─────────────
const stageEl = document.getElementById("main") as HTMLElement, panelBtn = document.getElementById("panel-btn") as HTMLButtonElement;
function setPanel(open: boolean) {
  stageEl.classList.toggle("panel-closed", !open);
  panel.hidden = !open;
  panelBtn.setAttribute("aria-pressed", String(open));
  panelBtn.title = open ? "Hide the details panel (\\)" : "Show the details panel (\\)";
  savePref("fraktul-panel", open ? "1" : "0");
  // The canvas just changed width: refit the flat map (the 3D view follows its own size).
  if (!in3d) requestAnimationFrame(() => fit());
}
panelBtn.addEventListener("click", () => setPanel(panel.hidden));
setPanel(pref("fraktul-panel", "1") === "1");

// ───────────── tour card: drag it by its title bar, fold it to the bar ─────────────
const narrowScreen = matchMedia("(max-width: 860px)");
// On a phone the tour card leaves the diagram and sits in the page right under it, so it never covers the map.
function homeCard() {
  if (narrowScreen.matches) { if (tourCard.parentElement !== stageEl) stageEl.insertBefore(tourCard, panel); }
  else if (tourCard.parentElement !== canvas) canvas.append(tourCard);
}
homeCard();
narrowScreen.addEventListener("change", homeCard);
function placeCard(x: number, y: number) {
  const r = canvas.getBoundingClientRect();
  const w = tourCard.offsetWidth, h = tourCard.offsetHeight;
  x = Math.max(8, Math.min(r.width - Math.min(w, r.width) - 8 + Math.max(0, w - r.width), x));
  y = Math.max(8, Math.min(r.height - Math.min(h, 44) - 8, y));
  tourCard.style.left = `${x}px`; tourCard.style.top = `${y}px`;
  return { x, y };
}
{
  let d: { x: number; y: number; ox: number; oy: number } | null = null;
  tourCard.addEventListener("pointerdown", (e) => {
    const head = (e.target as Element).closest(".tour-head");
    if (narrowScreen.matches) return;
    if (!head || (e.target as Element).closest("button, a, input, select")) return;
    e.preventDefault();
    d = { x: e.clientX, y: e.clientY, ox: tourCard.offsetLeft, oy: tourCard.offsetTop };
    tourCard.setPointerCapture(e.pointerId);
    tourCard.classList.add("is-dragging");
  });
  tourCard.addEventListener("pointermove", (e) => { if (d) placeCard(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y); });
  const end = () => {
    if (!d) return;
    d = null;
    tourCard.classList.remove("is-dragging");
    tourCard.classList.add("is-moved");
    savePref("fraktul-tour-pos", JSON.stringify([tourCard.offsetLeft, tourCard.offsetTop]));
  };
  tourCard.addEventListener("pointerup", end);
  tourCard.addEventListener("pointercancel", end);
  tourCard.addEventListener("dblclick", (e) => { if ((e.target as Element).closest(".tour-head") && !(e.target as Element).closest("button")) toggleCardMin(); });
  try {
    const p = JSON.parse(pref("fraktul-tour-pos", "null"));
    if (Array.isArray(p)) { tourCard.style.left = `${p[0]}px`; tourCard.style.top = `${p[1]}px`; tourCard.classList.add("is-moved"); }
  } catch { /* nothing saved */ }
  window.addEventListener("resize", () => { if (tourCard.classList.contains("is-moved")) placeCard(tourCard.offsetLeft, tourCard.offsetTop); });
}
function toggleCardMin() {
  const min = !tourCard.classList.contains("is-min");
  tourCard.classList.toggle("is-min", min);
  if (!in3d) fit();
}

// ───────────── keys, hash, theme, start ─────────────
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches("input, textarea") || toursDlg.open) return;
  if (e.key === "/") { e.preventDefault(); search.focus(); }
  if (e.key === "Backspace") { e.preventDefault(); back(); }
  if (e.key === "Escape") { if (!peek.hidden) hidePeek(); else if (selected) { selected = null; drawPanel(); markSelected(); } else back(); }
  if (e.key === "0" && !in3d) fit();
  if (e.key === "3") set3d(!in3d);
  if (e.key === "\\") setPanel(panel.hidden);
  if (e.key === " " && (tour || replay) && audio.src) { e.preventDefault(); if (audio.paused) audio.play(); else audio.pause(); }
  if (e.key === "ArrowRight" && tour) { const n = nextOf(); if (n) go(n); }
});
(document.getElementById("back") as HTMLElement).addEventListener("click", back);
// The logo goes to the project's home page when the model names one (fraktul.dev's map: the fraktul.dev home page),
// else to the top of the map.
const homeLink = document.getElementById("home") as HTMLAnchorElement;
if (SITE.meta.home) homeLink.href = SITE.meta.home;
else homeLink.addEventListener("click", (e) => { e.preventDefault(); endTour(); goTo(SITE.meta.root); });
function fromHash() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const [slug = "", box = ""] = path.split("/");
  const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  const params = new URLSearchParams(query);
  const key = decode(slug).includes(":") ? decode(slug) : slug ? `node:${slug.replace(/-/g, "_")}` : "";
  const rid = box ? decode(box) : null;
  const to3d = params.get("view") === "3d";
  // A link that opens in 3D also says which camera; without one, the reader's own last choice stands.
  if (to3d) F3D.setBird(params.get("cam") === "bird");
  // A link to a stop on a tour: the tour takes the reader to its own level.
  const linked = SITE.tours.find((t) => t.id === params.get("tour"));
  const stop = linked?.steps[Math.max(1, Number(params.get("step")) || 1) - 1];
  if (linked && stop && (tour?.t !== linked || tour.step !== stop)) {
    want3d = to3d && !in3d;
    if (in3d && !to3d) set3d(false);
    stopReplay();
    tour = { t: linked, step: stop, trail: [], listen: false } as any;
    showStep();
    return;
  }
  const known = !!key && hasDiagram(key) && (kindOf(key) !== "node" || !!SITE.nodes[key.slice(5)]);
  if (known && view()?.key !== key) {
    want3d = to3d && !in3d;
    if (in3d && !to3d) set3d(false);
    const path = stackTo(key);
    stack = path.map((k) => ({ key: k, expanded: [...(SITE.diagrams[k]?.expand ?? [])] }));
    selected = null;
    linkRid = rid;
    draw();
    return;
  }
  if (!stack.length) { want3d = to3d; goTo(SITE.meta.root); return; }
  if (known && rid !== selectedRid) { const b = rid ? current.boxes.get(rid) : null; if (b) { selected = b.target ?? `box:${b.box}`; drawPanel(); markSelected(b.rid); } else if (!rid && selected) { selected = null; drawPanel(); markSelected(); } }
  if (to3d !== in3d) set3d(to3d);
}
window.addEventListener("hashchange", fromHash);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { mermaidReady = false; peekCache.clear(); if (stack.length) draw(true); });
new MutationObserver(() => { mermaidReady = false; peekCache.clear(); if (stack.length) draw(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-style"] });

// Theme: system → light → dark, remembered in this browser.
const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;
function showTheme() {
  const isDark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  themeBtn.textContent = isDark ? "☾" : "☀";
  themeBtn.title = isDark ? "Switch to light" : "Switch to dark";
}
themeBtn.addEventListener("click", () => {
  // Flip to the opposite of what is on screen, whether that came from a saved choice or the system.
  const isDark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("fraktul-theme", next); } catch { /* private window */ }
  showTheme();
});
showTheme();
const stylePick = document.getElementById("style-pick") as HTMLSelectElement;
stylePick.value = document.documentElement.dataset.style === "y2k" ? "y2k" : "flat";
stylePick.addEventListener("change", () => {
  document.documentElement.dataset.style = stylePick.value;
  try { localStorage.setItem("fraktul-style", stylePick.value); } catch { /* private window */ }
});

function start() {
  const brand = document.getElementById("brand-text") as HTMLElement;
  brand.textContent = SITE.meta.brand;
  document.title = SITE.meta.title;
  // A page that carries Mermaid itself (a claude.ai Artifact, where nothing can be served beside it) draws at once.
  if (typeof mermaid !== "undefined") { fromHash(); return; }
  // Otherwise the page paints first, then loads fraktul's own copy of Mermaid from beside it (2.9 MB is too much to
  // hold the first paint for).
  // Meanwhile the breadcrumbs and the details panel already say where the link leads.
  try {
    const slug = location.hash.slice(1).split("?")[0].split("/")[0];
    let key = `node:${SITE.meta.root}`;
    try { const d = decodeURIComponent(slug); if (d.includes(":") ? hasDiagram(d) : !!SITE.nodes[slug.replace(/-/g, "_")] && hasDiagram(`node:${slug.replace(/-/g, "_")}`)) key = d.includes(":") ? d : `node:${slug.replace(/-/g, "_")}`; } catch { /* a malformed link opens the top */ }
    stack = stackTo(key).map((k) => ({ key: k, expanded: [] }));
    drawCrumbs();
    drawPanel();
  } catch { /* the map still draws once Mermaid is here */ }
  const s = document.createElement("script");
  s.src = MERMAID_URL;
  s.addEventListener("load", () => { stack = []; fromHash(); });
  s.addEventListener("error", () => board.replaceChildren(el("p", "error", "Mermaid did not load (vendor/mermaid.min.js is missing next to this page). Rebuild the map.")));
  document.head.append(s);
}
const MERMAID_URL = "vendor/mermaid.min.js";
if (document.readyState !== "loading") start(); else document.addEventListener("DOMContentLoaded", start);
