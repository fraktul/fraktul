// The 3D view (docs/3d-view.md, phase 1): the diagram on screen as a place you can fly through. The map hands over the
// boxes and arrows it just drew, with their positions read from Mermaid's SVG, so 3D always matches 2D. three.js loads
// (from vendor/, beside the page) the first time 3D is switched on; the 2D page carries only this file.
//
// Meaning comes from data (kind sets the shape family, status sets how solid it is, size comes from line counts);
// identity comes from a hash of the box's id (crown, setbacks, window pattern), so a block keeps its silhouette when
// its code changes.

type Family = "database" | "server" | "screen" | "terminal" | "gear" | "neural" | "document" | "person" | "cloud" | "diamond" | "package" | "folder" | "disk" | "queue" | "tablet" | "terrain" | "plain";
type Item3D = {
  rid: string; title: string; sub: string; family: Family; status?: string; tone: string;
  x: number; y: number; w: number; h: number; size: number | null; hash: number; drill: boolean;
};
type Group3D = { rid: string; title: string; x: number; y: number; w: number; h: number };
type Edge3D = { pts: [number, number][]; tone: string };
type Scene3D = { key: string; items: Item3D[]; groups: Group3D[]; edges: Edge3D[] };
type Hooks3D = { pick: (rid: string | null) => void; locked?: (on: boolean) => void; slow?: (on: boolean) => void; bird?: (on: boolean) => void };

// fraktul ships its own three.js beside the page (vendor/); the CDN is only a fallback for hosts that serve the page
// alone (a claude.ai Artifact), where the local file is not there.
const THREE_LOCAL = "vendor/three.module.min.js";
const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const UNIT = 1 / 40; // SVG px → world units
let T: any = null;

(window as any).Fraktul3D = (() => {
  let host: HTMLElement | null = null, hooks: Hooks3D | null = null;
  let renderer: any, scene: any, camera: any, world: any, raycaster: any;
  let shown = false, raf = 0, last = 0, sceneKey = "";
  let built: { meshes: any[]; byRid: Map<string, any>; labels: { el: HTMLElement; obj: any; dy: number; rid: string }[]; movers: { m: any; curve: any; t: number; sp: number }[]; rises: { obj: any; at: number; to: number }[]; streams: { line: any; dots: any[]; at: number }[]; flicker: any[]; t0: number } | null = null;
  let focusSet = new Set<string>();
  let hover: string | null = null;
  const look = { yaw: 0, pitch: -0.55, pos: null as any };
  let fly: { from: any; to: any; yaw0: number; yaw1: number; p0: number; p1: number; t: number; dur: number; done?: () => void } | null = null;
  // A slow circle around what the tour is talking about; any drag, wheel or key hands the camera back.
  let orbit: { c: any; r: number; h: number; yaw: number; speed: number } | null = null;
  // A camera move asked for while the entry flight is still running waits for it.
  let pending: (() => void) | null = null;
  const keys = new Set<string>();
  let palette: Record<string, number> = {};

  const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();
  const hex = (n: string, fb: string) => new T.Color(css(n) || fb).getHex();
  function readPalette() {
    palette = {
      bg: hex("space-bg", "#04060c"), grid: hex("space-grid", "#16233a"), grid2: hex("space-grid-2", "#0c1422"),
      code: hex("space-code", "#7fb3ff"), model: hex("space-model", "#e2a259"), human: hex("space-human", "#b49cff"),
      data: hex("space-data", "#f08fd0"), ext: hex("space-ext", "#8a9099"), fn: hex("space-fn", "#86a6c2"),
      file: hex("space-file", "#bfb28a"), district: hex("space-district", "#e9ebef"), plain: hex("space-plain", "#9096a0"),
      planned: hex("space-planned", "#7fb3ff"), focus: hex("space-focus", "#ffd27a"), edge: hex("space-edge", "#5d7290"),
    };
  }
  const tone = (t: string) => palette[t] ?? palette.plain;

  async function load() {
    if (T) return T;
    try { T = await import(/* @vite-ignore */ new URL(THREE_LOCAL, document.baseURI).href); }
    catch { T = await import(/* @vite-ignore */ THREE_CDN); }
    return T;
  }

  // ───────────── setup ─────────────
  async function show(el: HTMLElement, h: Hooks3D) {
    host = el; hooks = h;
    await load();
    readPalette();
    if (!renderer) {
      renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.domElement.className = "space-gl";
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(58, 1, 0.05, 600);
      camera.rotation.order = "YXZ";
      raycaster = new T.Raycaster();
      wire(renderer.domElement);
      new ResizeObserver(resize).observe(el);
    }
    el.prepend(renderer.domElement);
    scene.background = new T.Color(palette.bg);
    scene.fog = new T.Fog(palette.bg, 18, 90);
    shown = true;
    resize();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function hide() {
    lock(false);
    shown = false;
    cancelAnimationFrame(raf);
    keys.clear();
    sceneKey = "";
  }
  function resize() {
    if (!host || !renderer) return;
    const r = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height));
    camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }

  // ───────────── building a level ─────────────
  function clear() {
    if (world) {
      scene.remove(world);
      world.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); }); });
    }
    built?.labels.forEach((l) => l.el.remove());
    built = null;
  }

  // Window patterns: white marks on transparent, tinted by the material colour. Picked by the hash.
  const patterns: any[] = [];
  function pattern(i: number) {
    if (patterns[i]) return patterns[i];
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    if (i === 0) for (let k = 6; k < 64; k += 12) x.fillRect(k, 4, 2, 56); // vertical strips
    if (i === 1) for (let a = 6; a < 64; a += 10) for (let b = 6; b < 64; b += 10) x.fillRect(a, b, 3, 3); // dots
    if (i === 2) for (let k = 6; k < 64; k += 9) x.fillRect(4, k, 20 + ((k * 7) % 34), 2); // lines of code
    if (i === 3) { for (let k = 8; k < 44; k += 6) x.fillRect(k, 26, 3, 12); x.fillRect(50, 28, 8, 8); } // rack vents and a drive bay
    if (i === 4) { x.fillRect(6, 8, 10, 3); x.fillRect(6, 18, 30, 3); x.fillRect(6, 28, 22, 3); x.fillRect(6, 40, 6, 3); x.fillRect(14, 40, 2, 8); } // a terminal: prompt lines
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return (patterns[i] = t);
  }

  function edgesOf(geo: any, color: number, dashed: boolean, opacity = 1) {
    const g = new T.EdgesGeometry(geo, 25);
    const m = dashed ? new T.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity }) : new T.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new T.LineSegments(g, m);
    if (dashed) l.computeLineDistances();
    return l;
  }
  /** One solid with its outline. `win` adds the hashed window pattern on its faces. */
  function solid(geo: any, color: number, st: string | undefined, win: number | null, w = 1, h = 1) {
    const g = new T.Group();
    const planned = st === "planned" || st === "proposed";
    const fill = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(0.13), transparent: true, opacity: planned ? 0.08 : 0.94, depthWrite: !planned });
    const mesh = new T.Mesh(geo, fill);
    g.add(mesh);
    if (win !== null && !planned) {
      const tex = pattern(win).clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      const wm = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, color: new T.Color(color).multiplyScalar(0.55), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      g.add(wm);
    }
    if (st !== "proposed") g.add(edgesOf(geo, color, planned));
    g.userData.fill = fill;
    return g;
  }

  function hashBits(h: number, shift: number, n: number) { return ((h >>> shift) % n + n) % n; }

  /** The object for one box, standing on y = 0, footprint ~fw. Returns it with its height (for the label). */
  function make(it: Item3D): { obj: any; top: number } {
    const color = it.status === "external" || it.family === "cloud" ? palette.ext : it.status === "planned" ? palette.planned : tone(it.tone);
    const fw = Math.max(0.9, Math.min(it.w, it.h * 1.6) * UNIT * 0.62);
    const size = it.size ?? 0.35;
    const H = 0.8 + size * 6.5;
    const o = new T.Group();
    const st = it.status;
    let top = H;
    // Each family is drawn as the thing it is (see WORD_SHAPE in fraktul-map.ts); the hash varies the details, so two
    // databases or two servers never look identical, and size follows the lines of code behind the box.
    const add = (geo: any, x: number, y: number, z: number, w: number | null = null, ww = 1, hh = 1) => { const m = solid(geo, color, st, w, ww, hh); m.position.set(x, y, z); o.add(m); return m; };
    const glow = (geo: any, x: number, y: number, z: number, opacity = 0.9) => { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color, transparent: true, opacity })); m.position.set(x, y, z); o.add(m); return m; };
    switch (it.family) {
      case "database": {
        // The database icon: a stack of disks with gaps between them.
        const n = 2 + hashBits(it.hash, 2, 3), r = fw * 0.48, h = Math.max(0.35, (H * 0.85) / n);
        for (let i = 0; i < n; i++) add(new T.CylinderGeometry(r, r, h * 0.82, 28), 0, h * i + h / 2, 0);
        glow(new T.TorusGeometry(r * 1.0, 0.02, 6, 40), 0, h * n, 0, 0.7).rotation.x = Math.PI / 2;
        top = h * n;
        break;
      }
      case "disk": {
        // A drive: a flat case with a platter and a spindle on top.
        const w = fw * 1.1, d = fw * 0.8;
        add(new T.BoxGeometry(w, 0.35, d), 0, 0.175, 0);
        const plat = add(new T.CylinderGeometry(d * 0.4, d * 0.4, 0.06, 32), -w * 0.12, 0.38, 0);
        glow(new T.CylinderGeometry(0.05, 0.05, 0.1, 10), -w * 0.12, 0.44, 0);
        o.userData.spin = plat; o.userData.spinAxis = "y";
        const arm = add(new T.BoxGeometry(d * 0.42, 0.04, 0.06), w * 0.18, 0.44, d * 0.12); arm.rotation.y = 0.5;
        top = 0.6;
        break;
      }
      case "queue": {
        // Messages in a channel: a row of envelopes on a rail, nearest first.
        const n = 3 + hashBits(it.hash, 3, 3), w = fw * 1.4, bw = (w / n) * 0.72;
        add(new T.BoxGeometry(w + 0.2, 0.08, fw * 0.5), 0, 0.04, 0, null);
        for (let i = 0; i < n; i++) add(new T.BoxGeometry(bw, bw * 0.7, fw * 0.36), -w / 2 + (i + 0.5) * (w / n), 0.08 + bw * 0.35, 0);
        top = 0.2 + bw * 0.7;
        break;
      }
      case "server": {
        // An API or service: a rack of units with status lights.
        const units = 2 + hashBits(it.hash, 2, 4), uh = Math.max(0.32, (H * 0.9) / units), w = fw * 0.75, d = fw * 0.6;
        for (let i = 0; i < units; i++) {
          add(new T.BoxGeometry(w, uh * 0.86, d), 0, uh * i + uh / 2, 0, 3, 1, 1);
          for (let k = 0; k < 2; k++) glow(new T.SphereGeometry(0.035, 8, 6), w * 0.32 - k * 0.12, uh * i + uh / 2, d / 2 + 0.01, k === 0 ? 1 : 0.5);
        }
        top = uh * units;
        break;
      }
      case "screen": case "terminal": {
        // A page or app: a monitor on a stand. A command line tool gets a terminal prompt on its screen.
        const w = fw * 1.25, h = w * 0.62, y = 0.55 + h / 2;
        add(new T.CylinderGeometry(w * 0.22, w * 0.26, 0.06, 20), 0, 0.03, 0);
        add(new T.BoxGeometry(0.08, 0.55, 0.08), 0, 0.3, 0);
        add(new T.BoxGeometry(w, h, 0.12), 0, y, 0, it.family === "terminal" ? 4 : 2, 2, 1);
        if (it.family === "terminal") glow(new T.BoxGeometry(w * 0.12, 0.05, 0.02), -w * 0.28, y - h * 0.25, 0.07);
        top = y + h / 2;
        break;
      }
      case "gear": {
        // A function or algorithm: a cog, turning. The number of teeth comes from the hash.
        const r = 0.3 + size * 0.45, teeth = 6 + hashBits(it.hash, 2, 5) * 2, y = r + 0.35;
        const g = new T.Group(); g.position.y = y; o.add(g);
        const hub = solid(new T.CylinderGeometry(r, r, 0.22, 24), color, st, null); hub.rotation.x = Math.PI / 2; g.add(hub);
        for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2; const t = solid(new T.BoxGeometry(0.16, 0.2, 0.22), color, st, null); t.position.set(Math.cos(a) * (r + 0.08), Math.sin(a) * (r + 0.08), 0); t.rotation.z = a; g.add(t); }
        const axle = new T.Mesh(new T.CylinderGeometry(r * 0.25, r * 0.25, 0.3, 12), new T.MeshBasicMaterial({ color })); axle.rotation.x = Math.PI / 2; g.add(axle);
        add(new T.BoxGeometry(0.06, y, 0.06), 0, y / 2, -0.15);
        o.userData.spin = g;
        top = y + r + 0.2;
        break;
      }
      case "neural": {
        // A model: a small neural network, three layers of nodes wired together, gently turning.
        const sizes = [2 + hashBits(it.hash, 1, 2), 3 + hashBits(it.hash, 3, 2), 1 + hashBits(it.hash, 5, 2)], gap = fw * 0.42, y0 = 1.1;
        const g = new T.Group(); g.position.y = y0; o.add(g);
        const pts: any[][] = sizes.map((n, li) => Array.from({ length: n }, (_, k) => new T.Vector3((li - 1) * gap, (k - (n - 1) / 2) * 0.42, 0)));
        const wires: number[] = [];
        for (let li = 0; li < 2; li++) for (const a of pts[li]) for (const b of pts[li + 1]) wires.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const wg = new T.BufferGeometry(); wg.setAttribute("position", new T.Float32BufferAttribute(wires, 3));
        g.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color, transparent: true, opacity: 0.45 })));
        for (const layer of pts) for (const p of layer) { const m = solid(new T.IcosahedronGeometry(0.12, 1), color, st, null); m.position.copy(p); g.add(m); }
        add(new T.CylinderGeometry(0.02, 0.02, y0 - 0.5, 4), 0, (y0 - 0.5) / 2, 0);
        o.userData.spin = g; o.userData.spinAxis = "y"; o.userData.spinSpeed = 0.35;
        top = y0 + Math.max(...sizes) * 0.21 + 0.3;
        break;
      }
      case "document": {
        // A file or doc: a standing page with a folded corner and lines of text on it.
        const w = fw * 0.75, h = Math.max(1.1, H * 0.8), fold = w * 0.28;
        const shape = new T.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - fold); shape.lineTo(w / 2 - fold, h); shape.lineTo(-w / 2, h); shape.closePath();
        add(new T.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), 0, 0, -0.04, 2, 1, Math.max(1, Math.round(h)));
        top = h;
        break;
      }
      case "folder": {
        // A repo: a folder, tab and all.
        const w = fw * 1.1, h = 0.7, d = fw * 0.7;
        add(new T.BoxGeometry(w, h, d), 0, h / 2, 0);
        add(new T.BoxGeometry(w * 0.4, 0.14, d), -w * 0.3, h + 0.07, 0);
        top = h + 0.14;
        break;
      }
      case "person": {
        // A person: a figure with a head, standing on a ring.
        add(new T.CylinderGeometry(0.2, 0.3, 0.9, 16), 0, 0.45, 0);
        add(new T.SphereGeometry(0.2, 16, 12), 0, 1.15, 0);
        glow(new T.RingGeometry(0.38, 0.45, 32), 0, 0.02, 0, 0.5).rotation.x = -Math.PI / 2;
        top = 1.4;
        break;
      }
      case "cloud": {
        // An outside service: a cloud, floating.
        const y = 1.6, r = fw * 0.26;
        const puffs: [number, number, number, number][] = [[0, 0, 0, 1.2], [-1.1, -0.25, 0, 0.85], [1.1, -0.25, 0, 0.9], [0.5, 0.35, 0.2, 0.8], [-0.5, 0.25, -0.2, 0.75]];
        for (const [x, py, z, k] of puffs) add(new T.IcosahedronGeometry(r * k, 1), x * r, y + py * r, z * r);
        top = y + r * 1.5;
        break;
      }
      case "diamond": {
        // A decision: the flowchart diamond, standing up.
        const h = 1.4;
        const s2 = add(new T.OctahedronGeometry(fw * 0.42, 0), 0, h / 2 + 0.2, 0); s2.scale.y = h / (fw * 0.84);
        o.userData.spin = s2; o.userData.spinAxis = "y"; o.userData.spinSpeed = 0.25;
        top = h + 0.2;
        break;
      }
      case "package": {
        // A component or module: a parcel, with the tape band round it. Bigger code, bigger box; the hash stacks a
        // second, smaller parcel on some.
        const w = fw * 0.85, h = Math.max(0.7, H * 0.55);
        add(new T.BoxGeometry(w, h, w), 0, h / 2, 0, hashBits(it.hash, 4, 3), w, h);
        glow(new T.BoxGeometry(w * 0.18, h + 0.02, w + 0.02), 0, h / 2, 0, 0.35);
        top = h;
        if (hashBits(it.hash, 1, 2) && H > 2) { const w2 = w * 0.6, h2 = h * 0.45; add(new T.BoxGeometry(w2, h2, w2), w * 0.05, h + h2 / 2, -w * 0.05).rotation.y = 0.3; top = h + h2; }
        break;
      }
      case "tablet": {
        // A decision record: a stone tablet.
        const h = H * 0.6 + 0.9, w = fw * 0.75;
        const shape = new T.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2); shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); shape.closePath();
        add(new T.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }), 0, 0, -0.08, 2, 1, 2);
        top = h;
        break;
      }
      case "terrain": {
        // A whole system: a campus, a plate with a few buildings on it.
        const pw = Math.max(fw * 1.6, it.w * UNIT), pd = Math.max(fw, it.h * UNIT);
        add(new T.BoxGeometry(pw, 0.3, pd), 0, 0.15, 0);
        const n = 2 + hashBits(it.hash, 2, 3);
        for (let i = 0; i < n; i++) { const bh = 0.5 + ((it.hash >>> (i * 3)) % 7) * 0.15; add(new T.BoxGeometry(fw * 0.22, bh, fw * 0.22), (i - (n - 1) / 2) * fw * 0.32, 0.3 + bh / 2, ((i % 2) - 0.5) * pd * 0.3, 1, 1, 1); }
        top = 1.5;
        break;
      }
      default: {
        // A plain box with nothing behind it: a low block.
        const h = Math.max(0.5, H * 0.3);
        add(new T.BoxGeometry(fw * 0.8, h, fw * 0.8), 0, h / 2, 0);
        top = h;
      }
    }
    if (it.status === "prototype") o.userData.flicker = true;
    // Box under each block: a faint footprint, so the floor plan reads from above.
    const foot = new T.Mesh(new T.PlaneGeometry(it.w * UNIT * 0.92, it.h * UNIT * 0.92), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, depthWrite: false }));
    foot.rotation.x = -Math.PI / 2; foot.position.y = 0.01;
    o.add(foot);
    return { obj: o, top };
  }

  /** The box an arrow end touches (Mermaid ends arrows just outside the box). */
  function nearest(items: Item3D[], p: [number, number]): Item3D | null {
    let best: Item3D | null = null, d = Infinity;
    for (const it of items) { const dd = Math.hypot(Math.max(0, Math.abs(p[0] - it.x) - it.w / 2), Math.max(0, Math.abs(p[1] - it.y) - it.h / 2)); if (dd < d) { d = dd; best = it; } }
    return d < 40 ? best : null;
  }
  /** Sources first, then what they feed (the diagram's arrows); ties left to right, top to bottom. */
  function flowOrder(items: Item3D[], edges: Edge3D[]): Map<string, number> {
    const near = (p: [number, number]) => nearest(items, p);
    const indeg = new Map(items.map((i) => [i.rid, 0])), out = new Map<string, string[]>(items.map((i) => [i.rid, []]));
    for (const e of edges) {
      const a = near(e.pts[0]), b = near(e.pts[e.pts.length - 1]);
      if (!a || !b || a === b) continue;
      out.get(a.rid)!.push(b.rid); indeg.set(b.rid, indeg.get(b.rid)! + 1);
    }
    const pos = (r: string) => { const i = items.find((x) => x.rid === r)!; return i.x + i.y * 0.5; };
    const order = new Map<string, number>();
    const ready = items.filter((i) => !indeg.get(i.rid)).map((i) => i.rid);
    let n = 0;
    while (order.size < items.length) {
      if (!ready.length) { const left = items.filter((i) => !order.has(i.rid)).sort((a, b) => pos(a.rid) - pos(b.rid)); ready.push(left[0].rid); }
      ready.sort((a, b) => pos(a) - pos(b));
      const r = ready.shift()!;
      if (order.has(r)) continue;
      order.set(r, n++);
      for (const nx of out.get(r)!) { indeg.set(nx, indeg.get(nx)! - 1); if (indeg.get(nx)! <= 0 && !order.has(nx)) ready.push(nx); }
    }
    return order;
  }

  function build(s: Scene3D, o: { entry?: boolean } = {}) {
    if (!shown || !T) return;
    const same = s.key === sceneKey && built;
    clear();
    world = new T.Group();
    scene.add(world);
    // Centre the layout on the origin; SVG y runs to world z.
    const xs = [...s.items.map((i) => [i.x - i.w / 2, i.x + i.w / 2]), ...s.groups.map((g) => [g.x - g.w / 2, g.x + g.w / 2])].flat();
    const ys = [...s.items.map((i) => [i.y - i.h / 2, i.y + i.h / 2]), ...s.groups.map((g) => [g.y - g.h / 2, g.y + g.h / 2])].flat();
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const spanX = xs.length ? (Math.max(...xs) - Math.min(...xs)) * UNIT : 10, spanZ = ys.length ? (Math.max(...ys) - Math.min(...ys)) * UNIT : 10;
    const W = (x: number) => (x - cx) * UNIT, Z = (y: number) => (y - cy) * UNIT;

    const far = Math.max(90, Math.max(spanX, spanZ) * 4);
    scene.fog.near = far * 0.2; scene.fog.far = far;
    camera.far = far * 2; camera.updateProjectionMatrix();
    const grid = new T.GridHelper(Math.max(80, Math.max(spanX, spanZ) * 3), Math.max(40, Math.round(Math.max(spanX, spanZ) * 1.5)), palette.grid, palette.grid2);
    grid.position.y = -0.005;
    world.add(grid);

    level = { spanX, spanZ, top: 2, pts: s.items.map((i) => [W(i.x), Z(i.y)]) };
    const now = performance.now() / 1000;
    const reveal = !same;
    const base = now + (o.entry ? 0.5 : 0.1);
    const step = Math.min(0.22, 2.4 / Math.max(1, s.items.length));
    const order = flowOrder(s.items, s.edges);
    built = { meshes: [], byRid: new Map(), labels: [], movers: [], rises: [], streams: [], flicker: [], t0: now };

    for (const g of s.groups) {
      const plate = new T.Mesh(new T.BoxGeometry(g.w * UNIT, 0.06, g.h * UNIT), new T.MeshBasicMaterial({ color: palette.district, transparent: true, opacity: 0.04, depthWrite: false }));
      plate.position.set(W(g.x), 0.03, Z(g.y));
      const rim = edgesOf(plate.geometry, palette.district, false, 0.35);
      rim.position.copy(plate.position);
      world.add(plate, rim);
      label(g.title, "", plate, 0.4, g.rid, W(g.x - g.w / 2 + 12) - W(g.x), Z(g.y - g.h / 2 + 12) - Z(g.y));
    }
    for (const it of s.items) {
      const { obj, top } = make(it);
      level.top = Math.max(level.top, top);
      obj.position.set(W(it.x), 0, Z(it.y));
      obj.userData.rid = it.rid;
      world.add(obj);
      built.byRid.set(it.rid, obj);
      obj.traverse((m: any) => { if (m.isMesh) { m.userData.rid = it.rid; built!.meshes.push(m); } });
      if (obj.userData.flicker) built.flicker.push(obj);
      const at = reveal ? base + order.get(it.rid)! * step : 0;
      if (reveal) { obj.scale.set(1, 0.001, 1); obj.visible = false; }
      built.rises.push({ obj, at, to: 1 });
      label(it.title, it.sub, obj, top + 0.35, it.rid);
    }
    for (const e of s.edges) {
      if (e.pts.length < 2) continue;
      const p = e.pts.map(([x, y]) => new T.Vector3(W(x), 0, Z(y)));
      const len = p.reduce((n, v, i) => (i ? n + v.distanceTo(p[i - 1]) : 0), 0);
      const lift = Math.min(3.2, 0.6 + len * 0.18);
      const ctrl = p.map((v, i) => { const t = i / (p.length - 1); return new T.Vector3(v.x, 0.35 + Math.sin(Math.PI * t) * lift, v.z); });
      const curve = new T.CatmullRomCurve3(ctrl);
      const color = e.tone === "auto" ? tone(nearest(s.items, e.pts[0])?.tone ?? "edge") : tone(e.tone);
      const line = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(48)), new T.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      world.add(line);
      const dots: any[] = [];
      const n = Math.max(1, Math.min(4, Math.round(len / 3)));
      for (let i = 0; i < n; i++) {
        const d = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }));
        (d.material as any).color = new T.Color(color).lerp(new T.Color(0xffffff), 0.55);
        world.add(d);
        dots.push(d);
        built.movers.push({ m: d, curve, t: i / n, sp: 0.16 + ((i * 37) % 10) / 160 });
      }
      // A stream lights up once the block it points at has risen.
      const end = nearest(s.items, e.pts[e.pts.length - 1]);
      const at = reveal ? base + ((end ? order.get(end.rid)! : s.items.length) + 0.6) * step : 0;
      if (reveal) { line.visible = false; dots.forEach((d) => (d.visible = false)); }
      built.streams.push({ line, dots, at });
    }

    applyFocus();
    if (!same) {
      orbit = null; pending = null;
      // Where this level is seen from: on the ground in front of it, or from above (the Bird's eye switch).
      const { to, at } = home();
      const { yaw, pitch } = angles(to, at);
      if (o.entry) {
        // Entry: start looking straight down on the flat plan (the 2D map), then tilt down to the street.
        camera.position.set(0, Math.max(spanX / 1.6, spanZ * 1.15, 8), 0.01);
        look.yaw = 0; look.pitch = -Math.PI / 2 + 0.001;
        fly = { from: camera.position.clone(), to, yaw0: 0, yaw1: yaw, p0: look.pitch, p1: pitch, t: 0, dur: 2.4 };
      } else {
        camera.position.copy(to);
        look.yaw = yaw; look.pitch = pitch;
        fly = null;
      }
    }
    sceneKey = s.key;
  }

  function label(text: string, sub: string, obj: any, dy: number, rid: string, ox = 0, oz = 0) {
    if (!host || !built) return;
    const el = document.createElement("div");
    el.className = "space-label";
    el.append(text);
    if (sub) { const s = document.createElement("small"); s.textContent = sub; el.append(s); }
    host.append(el);
    built.labels.push({ el, obj, dy, rid });
    if (ox || oz) (el as any)._off = [ox, oz];
  }

  function applyFocus() {
    if (!built) return;
    const any = focusSet.size > 0;
    for (const [rid, obj] of built.byRid) {
      const on = focusSet.has(rid);
      obj.traverse((m: any) => {
        if (!m.material || m.userData.keep) return;
        const mats = [].concat(m.material);
        mats.forEach((mt: any) => {
          mt.userData.base ??= { color: mt.color?.getHex?.(), opacity: mt.opacity };
          const b = mt.userData.base;
          mt.opacity = any && !on ? b.opacity * 0.3 : b.opacity;
          if (mt.color && (m.isLineSegments || m.isLine)) mt.color.setHex(on ? palette.focus : b.color);
        });
      });
      obj.userData.beam && (obj.remove(obj.userData.beam), (obj.userData.beam = null));
      if (on) {
        const beam = new T.Mesh(new T.CylinderGeometry(0.5, 1.1, 30, 20, 1, true), new T.MeshBasicMaterial({ color: palette.focus, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false }));
        beam.position.y = 15;
        beam.userData.keep = true;
        obj.add(beam);
        obj.userData.beam = beam;
      }
    }
    built.labels.forEach((l) => l.el.classList.toggle("is-focus", focusSet.has(l.rid)));
    built.labels.forEach((l) => l.el.classList.toggle("is-dim", any && !focusSet.has(l.rid)));
  }
  function focus(rids: string[]) {
    focusSet = new Set(rids);
    applyFocus();
  }

  // ───────────── moving around: mouse to look, WASD to move, click to open ─────────────
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean; touches?: number; dist?: number } | null = null;
  function wire(cv: HTMLCanvasElement) {
    cv.tabIndex = 0;
    lockCv = cv;
    const stop = (e: Event) => e.stopPropagation();
    cv.addEventListener("pointerdown", (e) => {
      stop(e);
      if (locked()) { fly = null; orbit = null; pending = null; const r = cv.getBoundingClientRect(); hooks?.pick(pickAt(r.left + r.width / 2, r.top + r.height / 2)); return; }
      cv.focus({ preventScroll: true });
      fly = null; orbit = null; pending = null;
      drag = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch, moved: false };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      stop(e);
      // Mouse locked: every move turns the camera, no button needed; the click picks the block in the centre.
      if (locked()) {
        look.yaw -= e.movementX * 0.0032;
        look.pitch = Math.max(-1.45, Math.min(1.2, look.pitch - e.movementY * 0.0032));
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) {
          look.yaw = drag.yaw - dx * 0.0042;
          look.pitch = Math.max(-1.45, Math.min(1.2, drag.pitch - dy * 0.0042));
        }
        return;
      }
      hoverAt(e.clientX, e.clientY);
    });
    cv.addEventListener("pointerup", (e) => {
      stop(e);
      const d = drag;
      drag = null;
      if (d && !d.moved) { const rid = pickAt(e.clientX, e.clientY); hooks?.pick(rid); }
    });
    cv.addEventListener("pointerleave", () => { if (hover) { hover = null; cv.style.cursor = ""; } });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); stop(e); fly = null; orbit = null; moveBy(0, -e.deltaY * (slow ? 0.012 : 0.03), 0); }, { passive: false });
    // Two fingers: pinch to move forward and back.
    cv.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (drag) { if (drag.dist) moveBy(0, (d - drag.dist) * 0.03, 0); drag.dist = d; drag.moved = true; }
    }, { passive: false });
    cv.addEventListener("click", stop);
    document.addEventListener("keydown", (e) => {
      if (!shown || (e.target as HTMLElement).matches?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        if (k.startsWith("arrow")) e.preventDefault();
        keys.add(k); fly = null; orbit = null;
      }
      if (k === "0") { sceneKey = ""; hooks && rebuildLast(); }
      if (k === "l") lock(!locked());
      if (k === "z") setSlow(!slow);
      if (k === "b") setBird(!bird);
    });
    document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
  }
  // ───────────── mouse lock (Pointer Lock): look with plain mouse moves, Esc or L gives the mouse back ─────────────
  let slow = (() => { try { return localStorage.getItem("fraktul-3d-slow") === "1"; } catch { return false; } })();
  // ───────────── where a level is seen from: the ground (default) or a bird's eye, like a map's two views ─────────────
  let bird = (() => { try { return localStorage.getItem("fraktul-3d-bird") === "1"; } catch { return false; } })();
  let level: { spanX: number; spanZ: number; top: number; pts: number[][] } = { spanX: 10, spanZ: 10, top: 2, pts: [] };
  /** The camera's place for the whole level, and the point it looks at, far enough back that every block is in frame. */
  function home(): { to: any; at: any } {
    // The level fits in a circle of radius r. A narrow screen (a phone held upright) stands further back.
    const r = Math.hypot(Math.max(level.spanX, 4), Math.max(level.spanZ, 4)) / 2;
    const v = (camera.fov * Math.PI) / 360;
    const narrow = Math.max(1, 1.35 / camera.aspect); // bird's eye only: the ground view measures the corners
    if (bird) {
      // Stand back from the level and above it, looking across and down: every block in view, none behind another.
      const span = Math.max(level.spanX, level.spanZ, 6), yaw = -0.72, d = (span * 0.8 + 3) * narrow;
      const to = new T.Vector3(Math.sin(yaw) * d, Math.max(2.6, span * 0.22), Math.cos(yaw) * d);
      return { to, at: new T.Vector3(0, to.y - Math.tan(Math.atan2(to.y - 1.2, d) * 0.9) * d, 0) };
    }
    // On the ground, off to the front left, so the flow (left to right or top to bottom in the 2D map) runs across
    // the screen. Eye height is a person's, so blocks tower: close enough that the level fills the view, far enough
    // that the nearest block's top is still in frame.
    const yaw = -0.72;
    // Step back until every block is inside the view, left to right.
    const side = Math.atan(Math.tan(v) * camera.aspect) * 0.8;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    // Blocks near the camera spread wider than far ones, so the look turns to the middle of what it sees.
    let dist = r * 0.6 + 1.5, mid = 0;
    for (let i = 0; i < 60; i++, dist *= 1.06) {
      const cx = -fx * dist, cz = -fz * dist;
      const b = level.pts.map(([x, z]) => { const dx = x - cx, dz = z - cz; return dx * fx + dz * fz > 1.5 ? Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz) : NaN; });
      if (!b.length) break;
      const lo = Math.min(...b), hi = Math.max(...b);
      mid = (lo + hi) / 2;
      if (hi - lo < side * 2) break;
    }
    dist = Math.max(dist, r * 0.75 + (level.top * 0.7) / Math.tan(v));
    const eye = Math.min(2.4, 1.2 + r * 0.04);
    const to = new T.Vector3(-fx * dist, eye, -fz * dist);
    const ax = Math.cos(mid) * fx + Math.sin(mid) * fz, az = Math.cos(mid) * fz - Math.sin(mid) * fx;
    return { to, at: new T.Vector3(to.x + ax * dist, Math.max(eye * 0.9, level.top * 0.33), to.z + az * dist) };
  }
  function setBird(on: boolean) {
    if (on === bird) return;
    bird = on;
    try { localStorage.setItem("fraktul-3d-bird", on ? "1" : "0"); } catch { /* private window */ }
    hooks?.bird?.(on);
    if (shown && built) { orbit = null; pending = null; const h = home(); flyCam(h.to, h.at, 1.3); }
  }
  function setSlow(on: boolean) { slow = on; try { localStorage.setItem("fraktul-3d-slow", on ? "1" : "0"); } catch { /* private window */ } hooks?.slow?.(on); }
  let lockCv: HTMLCanvasElement | null = null;
  const locked = () => !!lockCv && document.pointerLockElement === lockCv;
  function lock(on: boolean) {
    if (!lockCv) return;
    if (on && !locked()) { fly = null; orbit = null; pending = null; (lockCv.requestPointerLock() as any)?.catch?.(() => {}); }
    if (!on && locked()) document.exitPointerLock();
  }
  document.addEventListener("pointerlockchange", () => {
    host?.classList.toggle("is-locked", locked());
    hooks?.locked?.(locked());
  });
  let lastScene: Scene3D | null = null;
  function rebuildLast() { if (lastScene) build(lastScene); }

  function moveBy(strafe: number, forward: number, up: number) {
    const f = new T.Vector3(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    const r = new T.Vector3(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    camera.position.addScaledVector(f, forward).addScaledVector(r, strafe);
    camera.position.y = Math.max(0.4, camera.position.y + up);
  }
  function ray(x: number, y: number) {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(built?.meshes ?? [], false).find((h: any) => h.object.visible && h.object.material.opacity > 0.03);
    return hit ? (hit.object.userData.rid as string) : null;
  }
  const pickAt = (x: number, y: number) => (built ? ray(x, y) : null);
  function hoverAt(x: number, y: number) {
    const rid = pickAt(x, y);
    if (rid === hover) return;
    hover = rid;
    renderer.domElement.style.cursor = rid ? "pointer" : "";
    built?.labels.forEach((l) => l.el.classList.toggle("is-hover", l.rid === rid));
  }

  // ───────────── camera moves: fly to blocks, circle them, dive into one ─────────────
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  /** Yaw and pitch that look from `from` at `at` (the camera looks down -Z, rotation order YXZ). */
  function angles(from: any, at: any) {
    const d = at.clone().sub(from);
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
  }
  function aim(at: any) { const a = angles(camera.position, at); look.yaw = a.yaw; look.pitch = a.pitch; }
  function flyCam(to: any, at: any, dur: number, done?: () => void) {
    const a = angles(to, at);
    fly = { from: camera.position.clone(), to, yaw0: look.yaw, yaw1: look.yaw + wrap(a.yaw - look.yaw), p0: look.pitch, p1: a.pitch, t: 0, dur, done };
  }
  /** Centre and size of some blocks, on the ground. */
  function boundsOf(rids: string[]) {
    if (!built) return null;
    const box = new T.Box3();
    let any = false;
    for (const rid of rids) { const o = built.byRid.get(rid); if (!o) continue;
      // The block's own meshes only: the focus beam (30 units of light) would put the camera in the sky.
      o.updateWorldMatrix(true, true);
      o.traverse((m: any) => { if (m.isMesh && m !== o.userData.beam && m.parent !== o.userData.beam && m.geometry) { m.geometry.computeBoundingBox?.(); if (m.geometry.boundingBox) { box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); any = true; } } }); }
    if (!any) return null;
    const c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    // Blocks still rising (the entry reveal) are nearly flat: assume a typical height.
    return { c, span: Math.max(size.x, size.z, 1.5), height: Math.max(size.y, 2) };
  }
  /** Swoop to look at these blocks from the front, a little above; then, if asked, circle them slowly. */
  let shot = 0;
    function flyTo(rids: string[], o: { orbit?: boolean } = {}) {
    if (!shown || !built || !rids.length) { orbit = null; return; }
    const run = () => {
      const b = boundsOf(rids);
      if (!b) return;
      const at = new T.Vector3(b.c.x, Math.max(0.6, b.height * 0.45), b.c.z);
      const dist = b.span * 1.1 + 5;
      // Come in from the front-left (where the level's own view stands): near the ground by default, or high enough
      // to look over the blocks in front with Bird's eye on. Each step swings a little left or right of that, so
      // moving between steps feels like a camera move.
      const swing = ((shot++ % 3) - 1) * 0.38;
      const yaw = -0.72 + swing;
      const h = at.y + dist * (bird ? 0.85 : 0.22);
      const to = new T.Vector3(at.x + Math.sin(yaw) * dist, h, at.z + Math.cos(yaw) * dist);
      orbit = null;
      flyCam(to, at, Math.min(2.2, 1.1 + camera.position.distanceTo(to) * 0.04), () => {
        if (o.orbit) orbit = { c: at, r: dist, h, yaw, speed: 0.07 };
      });
    };
    // Wait for the entry flight (top-down plan tilting to the street) to land first.
    if (fly && !fly.done) pending = run; else run();
  }
  /** Fly into a block, then call `done` (which opens it); the next level arrives with its own entry flight. */
  function dive(rid: string, done: () => void) {
    const b = boundsOf([rid]);
    if (!b || !shown) { done(); return; }
    orbit = null; pending = null;
    const at = new T.Vector3(b.c.x, Math.max(0.5, b.height * 0.5), b.c.z);
    const to = at.clone().add(camera.position.clone().sub(at).setLength(Math.max(0.6, b.span * 0.35)));
    flyCam(to, at, 0.75, done);
  }

  // ───────────── the frame loop ─────────────
  const v = () => new T.Vector3();
  let tmp: any = null;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function frame(ms: number) {
    if (!shown) return;
    raf = requestAnimationFrame(frame);
    // rAF's timestamp can be a little earlier than performance.now() taken in show(): never step backwards.
    const dt = Math.max(0, Math.min(0.05, (ms - last) / 1000));
    last = ms;
    const now = ms / 1000;
    tmp ??= v();
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const e = ease(fly.t);
      camera.position.lerpVectors(fly.from, fly.to, e);
      look.yaw = fly.yaw0 + (fly.yaw1 - fly.yaw0) * e;
      look.pitch = fly.p0 + (fly.p1 - fly.p0) * e;
      if (fly.t >= 1) {
        const done = fly.done;
        fly = null;
        done?.();
        if (pending) { const p = pending; pending = null; p(); }
      }
    } else if (orbit) {
      orbit.yaw += dt * orbit.speed;
      camera.position.set(orbit.c.x + Math.sin(orbit.yaw) * orbit.r, orbit.h, orbit.c.z + Math.cos(orbit.yaw) * orbit.r);
      aim(orbit.c);
    }
    if (keys.size) {
      // Fast by default; Shift, or the Slow switch, for fine moves.
      const sp = (slow || keys.has("shift") ? 5 : 20) * dt;
      const fw = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const st = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
      const up = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0);
      if (keys.has("arrowleft")) look.yaw += dt * 1.6;
      if (keys.has("arrowright")) look.yaw -= dt * 1.6;
      moveBy(st * sp, fw * sp, up * sp);
    }
    camera.rotation.set(look.pitch, look.yaw, 0);
    if (built) {
      for (const r of built.rises) {
        if (r.obj.scale.y >= 1) continue;
        if (now < r.at) continue;
        r.obj.visible = true;
        const k = Math.min(1, (now - r.at) / 0.55);
        r.obj.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3));
      }
      for (const s of built.streams) if (!s.line.visible && now >= s.at) { s.line.visible = true; s.dots.forEach((d) => (d.visible = true)); }
      for (const m of built.movers) { m.t = (m.t + dt * m.sp) % 1; m.m.position.copy(m.curve.getPoint(m.t)); }
      for (const o of built.byRid.values()) if (o.userData.spin) o.userData.spin.rotation[o.userData.spinAxis ?? "z"] += dt * (o.userData.spinSpeed ?? 0.6);
      for (const o of built.flicker) { const on = Math.sin(now * 9 + o.position.x) > -0.7; o.traverse((m: any) => { if (m.isLineSegments) m.material.opacity = on ? 1 : 0.25; }); }
    }
    renderer.render(scene, camera);
    if (built && host) {
      const w = host.clientWidth, h = host.clientHeight;
      const placed: { x: number; y: number; w: number; h: number; d: number; l: any }[] = [];
      for (const l of built.labels) {
        if (!l.obj.visible && l.obj.isGroup) { l.el.style.opacity = "0"; continue; }
        l.obj.getWorldPosition(tmp);
        const off = (l.el as any)._off;
        if (off) { tmp.x += off[0]; tmp.z += off[1]; }
        tmp.y += l.dy * (l.obj.scale?.y ?? 1);
        const dist = tmp.distanceTo(camera.position);
        tmp.project(camera);
        if (!(tmp.z < 1 && tmp.z > -1 && dist < 70)) { l.el.style.opacity = "0"; continue; }
        const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
        (l as any)._w ??= l.el.offsetWidth; (l as any)._h ??= l.el.offsetHeight;
        placed.push({ x, y, w: (l as any)._w, h: (l as any)._h, d: dist, l });
      }
      // Nearer labels win; a label that would sit on top of a nearer one fades out (hover or focus always shows).
      placed.sort((a, b) => a.d - b.d);
      const kept: typeof placed = [];
      for (const p of placed) {
        const must = p.l.rid === hover || focusSet.has(p.l.rid);
        const hit = kept.some((k) => Math.abs(k.x - p.x) * 2 < (k.w + p.w) * 0.95 && Math.abs(k.y - p.y) * 2 < (k.h + p.h) * 0.9);
        const op = Math.max(0, Math.min(1, (70 - p.d) / 30));
        if (hit && !must) { p.l.el.style.opacity = "0"; continue; }
        p.l.el.style.opacity = String(op);
        kept.push(p);
      }
    }
  }

  return {
    show, hide, focus, flyTo, dive,
    stopOrbit() { orbit = null; },
    lock, get locked() { return locked(); },
    setSlow, get slow() { return slow; },
    setBird, get bird() { return bird; },
    build(s: Scene3D, o?: { entry?: boolean }) { lastScene = s; build(s, o); },
    get shown() { return shown; },
  };
})();
