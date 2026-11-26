// The 3D view (docs/3d-view.md, phase 1): the diagram on screen as a place you can fly through. The map hands over the
// boxes and arrows it just drew, with their positions read from Mermaid's SVG, so 3D always matches 2D. three.js loads
// from the CDN the first time 3D is switched on; the 2D page carries only this file.
//
// Meaning comes from data (kind sets the shape family, status sets how solid it is, size comes from line counts);
// identity comes from a hash of the box's id (crown, setbacks, window pattern), so a block keeps its silhouette when
// its code changes.

type Family = "tower" | "stack" | "crystal" | "orb" | "island" | "pillar" | "tablet" | "gate" | "monolith" | "terrain" | "slab" | "core" | "plain";
type Item3D = {
  rid: string; title: string; sub: string; family: Family; status?: string; tone: string;
  x: number; y: number; w: number; h: number; size: number | null; hash: number; drill: boolean;
};
type Group3D = { rid: string; title: string; x: number; y: number; w: number; h: number };
type Edge3D = { pts: [number, number][]; tone: string };
type Scene3D = { key: string; items: Item3D[]; groups: Group3D[]; edges: Edge3D[] };
type Hooks3D = { pick: (rid: string | null) => void };

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
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
  let fly: { from: any; to: any; yaw0: number; yaw1: number; p0: number; p1: number; t: number; dur: number } | null = null;
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
    T = await import(/* @vite-ignore */ THREE_URL);
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
    const color = it.status === "external" || it.family === "monolith" ? palette.ext : it.status === "planned" ? palette.planned : tone(it.tone);
    const fw = Math.max(0.9, Math.min(it.w, it.h * 1.6) * UNIT * 0.62);
    const size = it.size ?? 0.35;
    const H = 0.8 + size * 6.5;
    const o = new T.Group();
    const st = it.family === "monolith" ? "built" : it.status;
    const win = hashBits(it.hash, 4, 3);
    let top = H;
    switch (it.family) {
      case "tower": case "plain": {
        const tiers = it.family === "plain" ? 1 : 1 + hashBits(it.hash, 2, 3);
        const height = it.family === "plain" ? Math.max(0.7, H * 0.35) : H;
        let y = 0, wdt = fw;
        for (let i = 0; i < tiers; i++) {
          const th = i === 0 ? height * (tiers === 1 ? 1 : 0.6) : (height * 0.4) / (tiers - 1);
          const s = solid(new T.BoxGeometry(wdt, th, wdt), color, st, win, wdt, th);
          s.position.y = y + th / 2;
          o.add(s);
          y += th; wdt *= 0.72;
        }
        top = y;
        if (it.family === "tower") {
          const crown = hashBits(it.hash, 0, 4);
          if (crown === 1) { const a = solid(new T.CylinderGeometry(0.03, 0.03, 1.2, 6), color, st, null); a.position.y = y + 0.6; o.add(a); const b = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshBasicMaterial({ color })); b.position.y = y + 1.25; o.add(b); top = y + 1.3; }
          if (crown === 2) { const p = solid(new T.ConeGeometry(wdt * 0.75, wdt * 0.8, 4), color, st, null); p.rotation.y = Math.PI / 4; p.position.y = y + wdt * 0.4; o.add(p); top = y + wdt * 0.8; }
          if (crown === 3) { const p = solid(new T.ConeGeometry(wdt * 0.28, 1.6, 6), color, st, null); p.position.y = y + 0.8; o.add(p); top = y + 1.6; }
        }
        break;
      }
      case "stack": {
        let y = 0, wdt = fw;
        for (let i = 0; i < 3; i++) { const th = H * [0.45, 0.33, 0.22][i]; const s = solid(new T.BoxGeometry(wdt, th, wdt), color, st, win, wdt, th); s.position.y = y + th / 2; s.rotation.y = i * 0.18; o.add(s); y += th; wdt *= 0.78; }
        top = y;
        break;
      }
      case "crystal": {
        const h = Math.max(1.6, H * 0.8);
        const s = solid(new T.OctahedronGeometry(fw * 0.55, 0), color, st, null);
        s.scale.y = h / (fw * 1.1);
        s.position.y = h / 2 + 0.1;
        o.add(s);
        top = h + 0.1;
        break;
      }
      case "orb": {
        const r = fw * 0.42, y = 1.2 + size * 2;
        const s = solid(new T.IcosahedronGeometry(r, 1), color, st, null); s.position.y = y; o.add(s);
        const ring = new T.Mesh(new T.TorusGeometry(r * 1.55, 0.025, 6, 48), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
        ring.rotation.x = Math.PI / 2 - 0.35; ring.position.y = y; o.add(ring); o.userData.spin = ring;
        const stem = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, y - r, 4), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })); stem.position.y = (y - r) / 2; o.add(stem);
        top = y + r;
        break;
      }
      case "island": {
        const s = solid(new T.CylinderGeometry(fw * 0.9, fw * 0.6, 0.4, 20), color, st, null); s.position.y = 0.2; o.add(s);
        const b = solid(new T.BoxGeometry(fw * 0.3, 1.2, fw * 0.3), color, st, win, 1, 1); b.position.set(-fw * 0.2, 1, 0); o.add(b);
        top = 1.6;
        break;
      }
      case "pillar": {
        const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.8, 8), new T.MeshBasicMaterial({ color })); p.position.y = 0.9; o.add(p);
        const head = new T.Mesh(new T.SphereGeometry(0.22, 16, 12), new T.MeshBasicMaterial({ color })); head.position.y = 2.05; o.add(head);
        const halo = new T.Mesh(new T.RingGeometry(0.35, 0.42, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: T.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; o.add(halo);
        top = 2.3;
        break;
      }
      case "tablet": {
        const s = solid(new T.BoxGeometry(fw * 0.8, H * 0.7 + 0.8, 0.18), color, st, 2, 1, 2); s.position.y = (H * 0.7 + 0.8) / 2; o.add(s);
        top = H * 0.7 + 0.8;
        break;
      }
      case "gate": {
        const gh = 1.8, gw = fw * 1.1;
        for (const sx of [-1, 1]) { const p = solid(new T.BoxGeometry(0.16, gh, 0.16), color, st, null); p.position.set((sx * gw) / 2, gh / 2, 0); o.add(p); }
        const bar = solid(new T.BoxGeometry(gw + 0.3, 0.16, 0.2), color, st, null); bar.position.y = gh; o.add(bar);
        top = gh + 0.1;
        break;
      }
      case "monolith": {
        const h = Math.max(3, H * 1.1);
        const s = solid(new T.BoxGeometry(fw * 0.6, h, fw * 0.25), palette.ext, "built", null); s.position.y = h / 2;
        s.userData.fill.color = new T.Color(0x101216); s.userData.fill.opacity = 1;
        o.add(s);
        top = h;
        break;
      }
      case "terrain": {
        const s = solid(new T.BoxGeometry(Math.max(fw * 1.6, it.w * UNIT), 0.5, Math.max(fw, it.h * UNIT)), color, st, null); s.position.y = 0.25; o.add(s);
        const b = solid(new T.BoxGeometry(fw * 0.3, 0.9, fw * 0.3), color, st, win, 1, 1); b.position.set(fw * 0.25, 0.95, 0); o.add(b);
        top = 1.5;
        break;
      }
      case "slab": {
        const s = solid(new T.BoxGeometry(fw * 1.1, H, fw * 0.4), color, st, 2, fw, H); s.position.y = H / 2; o.add(s);
        top = H;
        break;
      }
      case "core": {
        const c = 0.35 + size * 0.5, y = 0.9 + size;
        const s = solid(new T.BoxGeometry(c, c, c), color, st, null); s.position.y = y; s.rotation.set(0.5, 0.6, 0); o.add(s); o.userData.spin = s;
        s.userData.fill.color = new T.Color(color).multiplyScalar(0.35);
        top = y + c;
        break;
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
      // Stand back from the level, above it and off to the front left, so the flow (left to right or top to bottom
      // in the 2D map) runs across the screen and blocks stand apart instead of behind each other.
      const span = Math.max(spanX, spanZ, 6);
      const yaw = -0.72;
      const dist = span * 0.95 + 3;
      const to = new T.Vector3(Math.sin(yaw) * dist, Math.max(4.5, span * 0.45), Math.cos(yaw) * dist);
      const pitch = -Math.atan2(to.y - 0.8, dist) * 0.92;
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
    const stop = (e: Event) => e.stopPropagation();
    cv.addEventListener("pointerdown", (e) => {
      stop(e);
      cv.focus({ preventScroll: true });
      fly = null;
      drag = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch, moved: false };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      stop(e);
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
    cv.addEventListener("wheel", (e) => { e.preventDefault(); stop(e); fly = null; moveBy(0, -e.deltaY * 0.012, 0); }, { passive: false });
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
        keys.add(k); fly = null;
      }
      if (k === "0") { sceneKey = ""; hooks && rebuildLast(); }
    });
    document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
  }
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
      if (fly.t >= 1) fly = null;
    }
    if (keys.size) {
      const sp = (keys.has("shift") ? 16 : 7) * dt;
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
      for (const o of built.byRid.values()) if (o.userData.spin) o.userData.spin.rotation.z += dt * 0.6;
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
    show, hide, focus,
    build(s: Scene3D, o?: { entry?: boolean }) { lastScene = s; build(s, o); },
    get shown() { return shown; },
  };
})();
