import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseFlowchart } from "../src/lib/mermaid.ts";
import { arrowsOf, compareTraces, observedMermaid, publicSource, readSpans, spansOf, summarize } from "../src/lib/traces.ts";

const attr = (o: Record<string, string>) => Object.entries(o).map(([key, v]) => ({ key, value: { stringValue: v } }));
const span = (traceId: string, spanId: string, parentSpanId: string, name: string, kind: number, a: Record<string, string> = {}, error = false) =>
  ({ traceId, spanId, parentSpanId, name, kind, startTimeUnixNano: "1764230400000000000", endTimeUnixNano: "1764230400020000000", attributes: attr(a), status: error ? { code: 2 } : {} });
const resource = (service: string, spans: unknown[]) => ({ resource: { attributes: attr({ "service.name": service, "telemetry.sdk.language": "go" }) }, scopeSpans: [{ spans }] });
// One request: web → checkout (HTTP) → payment (gRPC, fails) and checkout → postgresql, then checkout → kafka.
const OTLP = {
  resourceSpans: [
    resource("web", [span("t1", "a1", "", "GET /cart", 2), span("t1", "a2", "a1", "POST /checkout", 3, { "http.request.method": "POST" })]),
    resource("checkout", [span("t1", "b1", "a2", "POST /checkout", 2, { "http.route": "/checkout" }), span("t1", "b2", "b1", "Charge", 3, { "rpc.system": "grpc" }), span("t1", "b3", "b1", "INSERT orders", 3, { "db.system": "postgresql" }), span("t1", "b4", "b1", "orders publish", 4, { "messaging.system": "kafka" })]),
    resource("payment", [span("t1", "c1", "b2", "PaymentService/Charge", 2, { "rpc.system": "grpc" }, true)]),
  ],
};

test("traces: OTLP JSON becomes services and the calls between them, databases and queues included", () => {
  const o = summarize(spansOf(OTLP), "https://user:secret@jaeger.example.com/ui?token=abc");
  assert.equal(o.source, "https://jaeger.example.com/ui", "credentials and query never reach the summary");
  assert.deepEqual(Object.keys(o.services), ["checkout", "kafka", "payment", "postgresql", "web"]);
  assert.equal(o.services.postgresql.external, true);
  assert.deepEqual(o.edges.map((e) => `${e.from}>${e.to} ${e.via.join()} ${e.calls}/${e.errors}`), ["checkout>kafka messages 1/0", "checkout>payment gRPC 1/1", "checkout>postgresql queries 1/0", "web>checkout HTTP 1/0"]);
  assert.equal(o.traces, 1);
  assert.equal(o.edges[0].p95, 20);
  assert.match(observedMermaid(o), /web -- "HTTP" --> checkout/);
  assert.equal(JSON.stringify(o).includes("INSERT"), false, "client span names (queries) are not kept");
});

test("traces: Jaeger's API JSON and line-delimited files read the same", () => {
  const jaeger = { data: [{ traceID: "t1", processes: { p1: { serviceName: "web" }, p2: { serviceName: "cart" } }, spans: [
    { spanID: "1", operationName: "GET /", references: [], startTime: 1764230400000000, duration: 5000, tags: [{ key: "span.kind", value: "server" }], processID: "p1" },
    { spanID: "2", operationName: "GetCart", references: [{ refType: "CHILD_OF", spanID: "1" }], startTime: 1764230400001000, duration: 2000, tags: [{ key: "span.kind", value: "server" }, { key: "rpc.system", value: "grpc" }], processID: "p2" },
  ] }] };
  assert.deepEqual(summarize(spansOf(jaeger), "x").edges.map((e) => [e.from, e.to, e.via[0], e.p50]), [["web", "cart", "gRPC", 2]]);
  const dir = mkdtempSync(join(tmpdir(), "fraktul-traces-"));
  writeFileSync(join(dir, "a.jsonl"), `${JSON.stringify(OTLP)}\n${JSON.stringify(jaeger)}\n`);
  assert.equal(readSpans(dir).length, 9);
  assert.equal(publicSource("/Users/someone/otel/traces.jsonl, export/"), "traces.jsonl, export", "a file keeps its name, not its folder");
});

test("traces: arrows are read from a diagram, and the model is compared with what happened", () => {
  assert.deepEqual(arrowsOf(parseFlowchart('flowchart LR\n  web["Web"] --> checkout -- "pays" --> payment & db\n  a ~~~ b\n  class web code')), [["web", "checkout"], ["checkout", "payment"], ["checkout", "db"]]);
  const node = (title: string, service?: string, diagram?: string) => ({ title, ...(service ? { service } : {}), ...(diagram ? { diagram } : {}) });
  const model: any = { nodes: { shop: node("Shop", undefined, "flowchart LR\n  web --> checkout\n  checkout --> mail"), web: node("Web", "web"), checkout: node("Checkout", "checkout"), payment: node("Payment", "payment"), mail: node("Mail", "mailer") } };
  const r = compareTraces(model, summarize(spansOf(OTLP), "x"));
  assert.deepEqual(r.undrawn, [{ from: "checkout", to: "payment", calls: 1 }], "a real call nobody drew");
  assert.deepEqual(r.unmapped, ["kafka", "postgresql"]);
  assert.deepEqual(r.unseen, [{ from: "checkout", to: "mail" }], "drawn, never seen");
  assert.deepEqual(r.unknown, [{ node: "mail", service: "mailer" }]);
});
