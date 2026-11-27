// What the running system says: which services call which, read from distributed traces (OpenTelemetry).
//
// The model says how the system is meant to fit together; the code says what each part contains; traces say what
// actually talks to what in production. `fraktul traces` boils traces down to a small summary (traces.json beside
// the model: services, calls between them, error counts, latency; no payloads, no attribute values) and the check
// and the map compare it with what the model draws.
//
// Two inputs are read:
//   - OTLP JSON, as the OpenTelemetry Collector's `file` exporter writes it (one ExportTraceServiceRequest per line);
//   - Jaeger's query API JSON ({ data: [{ spans, processes }] }), from a saved file or straight from a Jaeger URL.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFlowchart, type Parsed } from "./mermaid.ts";
import type { Model } from "./model.ts";

export type Span = { trace: string; id: string; parent: string | null; service: string; name: string; kind: "server" | "client" | "producer" | "consumer" | "internal"; start: number; ms: number; error: boolean; attrs: Record<string, string> };

export type ObservedEdge = { from: string; to: string; calls: number; errors: number; via: string[]; p50: number; p95: number };
export type ObservedService = { spans: number; errors: number; language?: string; operations: { name: string; count: number }[]; external?: boolean };
export type Observed = {
  version: 1;
  /** Where the traces came from, as given on the command line (a URL's credentials are never kept). */
  source: string;
  /** First and last span seen, ISO dates. */
  from: string | null;
  to: string | null;
  traces: number;
  spans: number;
  services: Record<string, ObservedService>;
  edges: ObservedEdge[];
};

const KINDS = ["internal", "internal", "server", "client", "producer", "consumer"] as const;
const kindOf = (k: unknown): Span["kind"] => (typeof k === "number" ? KINDS[k] ?? "internal" : (String(k ?? "").toLowerCase().replace(/^span_kind_/, "") as Span["kind"]) || "internal");

/** OTLP's attribute list ([{ key, value: { stringValue | intValue | … } }]) as a plain record of strings. */
function otlpAttrs(list: any[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of list ?? []) { const v = a.value ?? {}; out[a.key] = String(v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? ""); }
  return out;
}

function otlpSpans(doc: any): Span[] {
  const out: Span[] = [];
  for (const rs of doc.resourceSpans ?? doc.resource_spans ?? []) {
    const res = otlpAttrs(rs.resource?.attributes);
    const service = res["service.name"] || "unknown";
    for (const ss of rs.scopeSpans ?? rs.scope_spans ?? []) for (const s of ss.spans ?? []) {
      const start = Number(BigInt(s.startTimeUnixNano ?? s.start_time_unix_nano ?? 0) / 1_000_000n);
      const end = Number(BigInt(s.endTimeUnixNano ?? s.end_time_unix_nano ?? 0) / 1_000_000n);
      const code = s.status?.code;
      const attrs = otlpAttrs(s.attributes);
      if (res["telemetry.sdk.language"]) attrs["telemetry.sdk.language"] = res["telemetry.sdk.language"];
      out.push({ trace: s.traceId ?? s.trace_id, id: s.spanId ?? s.span_id, parent: s.parentSpanId || s.parent_span_id || null, service, name: s.name ?? "", kind: kindOf(s.kind), start, ms: Math.max(0, end - start), error: code === 2 || code === "STATUS_CODE_ERROR", attrs });
    }
  }
  return out;
}

function jaegerSpans(doc: any): Span[] {
  const out: Span[] = [];
  for (const t of doc.data ?? []) {
    for (const s of t.spans ?? []) {
      const attrs: Record<string, string> = {};
      for (const tag of s.tags ?? []) attrs[tag.key] = String(tag.value);
      const proc = t.processes?.[s.processID] ?? {};
      for (const tag of proc.tags ?? []) if (tag.key === "telemetry.sdk.language") attrs[tag.key] = String(tag.value);
      const refs: any[] = s.references ?? [];
      const parent = (refs.find((r) => r.refType === "CHILD_OF") ?? refs[0])?.spanID ?? null;
      out.push({ trace: s.traceID ?? t.traceID, id: s.spanID, parent, service: proc.serviceName ?? "unknown", name: s.operationName ?? "", kind: kindOf(attrs["span.kind"]), start: Math.round((s.startTime ?? 0) / 1000), ms: (s.duration ?? 0) / 1000, error: attrs.error === "true" || attrs["otel.status_code"] === "ERROR", attrs });
    }
  }
  return out;
}

/** Spans from one JSON document in either format. */
export function spansOf(doc: any): Span[] {
  if (doc?.resourceSpans || doc?.resource_spans) return otlpSpans(doc);
  if (Array.isArray(doc?.data)) return jaegerSpans(doc);
  return [];
}

/** Spans from a file (JSON, or one JSON document per line) or every such file in a folder. */
export function readSpans(path: string): Span[] {
  if (statSync(path).isDirectory()) return readdirSync(path).filter((f) => /\.(json|jsonl|ndjson)$/.test(f)).sort().flatMap((f) => readSpans(join(path, f)));
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  try { return spansOf(JSON.parse(text)); } catch { /* not one document: one per line */ }
  return text.split("\n").filter((l) => l.trim()).flatMap((l) => { try { return spansOf(JSON.parse(l)); } catch { return []; } });
}

/** Spans from a running Jaeger: every service's recent traces. `base` is the query API's address (…/api is added). */
export async function fetchJaeger(base: string, o: { lookback?: string; limit?: number } = {}): Promise<Span[]> {
  const api = `${base.replace(/\/$/, "").replace(/\/api$/, "")}/api`;
  const get = async (path: string) => { const r = await fetch(`${api}${path}`); if (!r.ok) throw new Error(`${api}${path}: HTTP ${r.status}`); return r.json(); };
  const services: string[] = (await get("/services")).data ?? [];
  const seen = new Set<string>();
  const spans: Span[] = [];
  for (const s of services) {
    const doc = await get(`/traces?service=${encodeURIComponent(s)}&limit=${o.limit ?? 200}&lookback=${encodeURIComponent(o.lookback ?? "1h")}`);
    doc.data = (doc.data ?? []).filter((t: any) => !seen.has(t.traceID) && seen.add(t.traceID));
    spans.push(...jaegerSpans(doc));
  }
  return spans;
}

/** How a call travelled, from the attributes the instrumentation set. */
function viaOf(s: Span): string {
  const a = s.attrs;
  if (a["rpc.system"]) return a["rpc.system"] === "grpc" ? "gRPC" : a["rpc.system"];
  if (a["messaging.system"]) return a["messaging.system"];
  if (a["http.request.method"] || a["http.method"] || a["http.route"] || a["url.full"] || a["http.url"]) return "HTTP";
  return "call";
}
const pct = (sorted: number[], p: number) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 10) / 10 : 0);

/** A URL without its user, password or query, for the record of where traces came from. */
export function publicSource(s: string): string {
  if (/^https?:\/\//.test(s)) { try { const u = new URL(s); return `${u.protocol}//${u.host}${u.pathname}`; } catch { /* fall through: treat it as a path */ } }
  // A file: its name only, not where it sat on someone's machine.
  return s.split(", ").map((p) => p.replace(/\/+$/, "").split("/").pop()).join(", ");
}

/** Boils spans down to services and the calls between them. */
export function summarize(spans: Span[], source: string): Observed {
  const byId = new Map<string, Span>();
  for (const s of spans) byId.set(`${s.trace}:${s.id}`, s);
  const services: Record<string, ObservedService & { ops: Map<string, number> }> = {};
  const svc = (name: string, external = false) => (services[name] ??= { spans: 0, errors: 0, operations: [], ops: new Map(), ...(external ? { external: true } : {}) });
  const edges = new Map<string, { from: string; to: string; calls: number; errors: number; via: Set<string>; ms: number[] }>();
  const edge = (from: string, to: string, s: Span, via: string) => {
    const e = edges.get(`${from}>${to}`) ?? { from, to, calls: 0, errors: 0, via: new Set<string>(), ms: [] };
    e.calls++; if (s.error) e.errors++; e.via.add(via); e.ms.push(s.ms);
    edges.set(`${from}>${to}`, e);
  };
  const hasChildElsewhere = new Set<string>();
  for (const s of spans) { const p = s.parent ? byId.get(`${s.trace}:${s.parent}`) : null; if (p && p.service !== s.service) hasChildElsewhere.add(`${p.trace}:${p.id}`); }
  for (const s of spans) {
    const me = svc(s.service);
    me.spans++; if (s.error) me.errors++;
    if (s.attrs["telemetry.sdk.language"]) me.language = s.attrs["telemetry.sdk.language"];
    if (s.kind === "server" || s.kind === "consumer") me.ops.set(s.name, (me.ops.get(s.name) ?? 0) + 1);
    // A span whose parent ran in another service is one call from that service to this one.
    const p = s.parent ? byId.get(`${s.trace}:${s.parent}`) : null;
    if (p && p.service !== s.service) edge(p.service, s.service, s, viaOf(s.attrs["rpc.system"] || s.attrs["messaging.system"] ? s : p.attrs["rpc.system"] ? p : s));
    // A client call nobody answered with a span of their own went to something uninstrumented: a database, a
    // cache, a queue. Its name comes from the attributes.
    if ((s.kind === "client" || s.kind === "producer") && !hasChildElsewhere.has(`${s.trace}:${s.id}`)) {
      const to = s.attrs["db.system.name"] || s.attrs["db.system"] || s.attrs["messaging.system"] || s.attrs["peer.service"];
      if (to && to !== s.service) { svc(to, true).spans++; edge(s.service, to, s, s.attrs["messaging.system"] ? "messages" : s.attrs["peer.service"] ? viaOf(s) : "queries"); }
    }
    // A message taken off a queue: the queue hands it to this service. (The consumer's span is often only linked to
    // the producer's, not its child, so the queue is the honest "from".)
    if (s.kind === "consumer" && s.attrs["messaging.system"] && !(p && p.service !== s.service)) { svc(s.attrs["messaging.system"], true).spans++; edge(s.attrs["messaging.system"], s.service, s, "messages"); }
  }
  const times = spans.map((s) => s.start).filter((t) => t > 0);
  return {
    version: 1, source: publicSource(source),
    from: times.length ? new Date(Math.min(...times)).toISOString() : null, to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    traces: new Set(spans.map((s) => s.trace)).size, spans: spans.length,
    services: Object.fromEntries(Object.entries(services).sort(([a], [b]) => a.localeCompare(b)).map(([k, { ops, ...v }]) => [k, { ...v, operations: [...ops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })) }])),
    edges: [...edges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).map((e) => { const ms = e.ms.sort((a, b) => a - b); return { from: e.from, to: e.to, calls: e.calls, errors: e.errors, via: [...e.via].sort(), p50: pct(ms, 0.5), p95: pct(ms, 0.95) }; }),
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "s$1") || "service";

/** The observed service graph as a Mermaid flowchart: a first diagram to paste into a model and then improve. */
export function observedMermaid(o: Observed): string {
  const lines = ["flowchart LR"];
  for (const [name, s] of Object.entries(o.services)) lines.push(`  ${slug(name)}${s.external ? `[("${name}")]:::data` : `["${name}"]`}`);
  for (const e of o.edges) lines.push(`  ${slug(e.from)} -- "${e.via.join(", ")}" --> ${slug(e.to)}`);
  return lines.join("\n");
}

// ───────────── the model against the traces ─────────────

/** The summary a model points at (`traces:`, default traces.json beside the model), or null when there is none. */
export function loadObserved(m: Model): Observed | null {
  const path = join(m.dir, m.traces ?? "traces.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Observed;
}

/** Every arrow a flowchart draws, as [from, to] box ids (`a --> b & c --> d` is three arrows; `~~~` draws none). */
export function arrowsOf(p: Parsed): [string, string][] {
  const out: [string, string][] = [];
  for (const line of p.lines) {
    if (line.kind || line.tok.length < 2 || /^subgraph\b/.test(line.t)) continue;
    const parts = line.t.split(/\u0001(\d+)\u0002/);
    // parts: text, index, text, index, … Group the boxes joined by "&"; an arrow between two groups joins each pair.
    let group: string[] = [], prev: string[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const between = parts[i - 1];
      if (i > 1 && /[-=.]{2}|-->/.test(between)) { prev = group; group = []; }
      else if (i > 1 && /~~~/.test(between)) { prev = []; group = []; }
      const id = line.tok[Number(parts[i])].id;
      group.push(id);
      for (const a of prev) out.push([a, id]);
    }
  }
  return out;
}

export type TraceReport = {
  /** Services in the traces that no block claims with `service:`. */
  unmapped: string[];
  /** Calls the traces show between two mapped blocks that no diagram draws: "from → to". */
  undrawn: { from: string; to: string; calls: number }[];
  /** Arrows the model draws between two mapped blocks that the traces never showed. */
  unseen: { from: string; to: string }[];
  /** `service:` names that are not in the traces. */
  unknown: { node: string; service: string }[];
};

/** Which blocks stand for which services (`service:` on a node, one name or several). */
export function serviceNodes(m: Model): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, n] of Object.entries(m.nodes)) for (const s of [n.service ?? []].flat()) out.set(s, id);
  return out;
}

/** Compares what the model draws with what the traces saw. */
export function compareTraces(m: Model, o: Observed): TraceReport {
  const nodeOf = serviceNodes(m);
  const drawn = new Set<string>();
  for (const n of Object.values(m.nodes)) if (n.diagram) for (const [a, b] of arrowsOf(parseFlowchart(n.diagram))) drawn.add(`${a}>${b}`);
  const seen = new Set<string>();
  const undrawn: TraceReport["undrawn"] = [];
  for (const e of o.edges) {
    const a = nodeOf.get(e.from), b = nodeOf.get(e.to);
    if (!a || !b || a === b) continue;
    seen.add(`${a}>${b}`);
    if (!drawn.has(`${a}>${b}`) && !undrawn.some((u) => u.from === a && u.to === b)) undrawn.push({ from: a, to: b, calls: e.calls });
  }
  const mapped = new Set(nodeOf.values());
  const unseen = [...drawn].map((k) => k.split(">")).filter(([a, b]) => mapped.has(a) && mapped.has(b) && !seen.has(`${a}>${b}`)).map(([from, to]) => ({ from, to }));
  return {
    unmapped: Object.keys(o.services).filter((s) => !nodeOf.has(s)),
    undrawn, unseen,
    unknown: [...nodeOf.entries()].filter(([s]) => !o.services[s]).map(([service, node]) => ({ node, service })),
  };
}
