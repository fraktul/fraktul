---
title: Traces
summary: Read OpenTelemetry traces into the fraktul, so it shows which services really talk to each other, and the check notices when the diagram disagrees.
section: Guides
---
The repository tells fraktul what each service contains. It does not say which services call each other in
production: that is in your traces. If your system already sends OpenTelemetry traces, `fraktul traces` reads them
and adds what really happens to the fraktul.

You get two things:

- **Real traffic in every service's panel:** who calls it, what it calls, how often, how fast, how often it fails.
- **A check against reality:** `fraktul check` lists calls the traces show that no diagram draws, and services that
  are on no diagram at all.

[The demo shop](/docs/demo) is the OpenTelemetry Demo, about twenty services, mapped with fraktul from its code and
its traces. You can open it or run it yourself.

## 1. Read the traces

Point `fraktul traces` at wherever your traces already are.

**A Jaeger query address.** fraktul asks for each service's recent traces:

```bash
fraktul traces http://jaeger.internal:16686
fraktul traces http://jaeger.internal:16686 --lookback 6h --limit 500
```

**OTLP JSON files**, as the OpenTelemetry Collector's `file` exporter writes them. Add the exporter to a traces
pipeline, let it run, and read the file or the folder:

```yaml
# otel-collector config
exporters:
  file/fraktul:
    path: /var/otel/traces.jsonl
service:
  pipelines:
    traces:
      exporters: [otlp, file/fraktul]
```

```bash
fraktul traces /var/otel/traces.jsonl
```

Any backend that can export OTLP JSON or Jaeger's API JSON works the same way: save the JSON and pass the file.

Either way, fraktul writes `traces.json` beside the model:

```text
fraktul: docs/arch/traces.json: 18 services, 31 calls between them, from 2,412 traces (38,077 spans)
```

> [!NOTE]
> `traces.json` is a summary: service names, the calls between them with counts, error counts and latency, the
> names of the operations each service serves, and the dates of the first and last span. It holds no request data,
> no attribute values and no client span names (which can carry SQL). Commit it.

## 2. Say which block is which service

Give each block the name its service has in the traces (OpenTelemetry's `service.name`):

```yaml
nodes:
  checkout:
    title: Checkout
    kind: service
    service: checkout
  orders_db:
    title: Orders database
    kind: data
    service: postgresql        # databases, caches and queues appear under their system's name
  storefront:
    title: Storefront
    kind: service
    service: [frontend, frontend-proxy]   # one block can stand for several services
```

A database, cache or queue that sends no traces of its own still shows up: fraktul names it from the calling span's
`db.system`, `messaging.system` or `peer.service` attribute (`postgresql`, `redis`, `kafka`).

## 3. Run the check

```bash
fraktul check
```

```text
Against the traces: 1 call not drawn, 1 service not in the fraktul
  call     Checkout → Email happens (417 calls in the traces) but no diagram draws checkout --> email
  service  fraud-detection is in the traces; no block says service: fraud-detection
  unseen   cart --> ad is drawn, but the traces never showed that call
```

| Line | Means | Fails `--strict` |
|---|---|---|
| `call` | Two mapped services talk, and no diagram has that arrow | yes |
| `service` | A service is in the traces and no block claims it | yes |
| `unseen` | An arrow is drawn between two mapped services, and the traces never showed it | no |
| `unknown` | A block names a service that is not in the traces | no |

`unseen` and `unknown` don't fail, because a short capture misses rare calls. They are still worth a look: an arrow
nobody has seen in a week of traces may be a call that was removed.

An arrow counts as drawn when any diagram in the model has it, in that direction, between the two blocks.

## In the fraktul

A block with `service:` gets a **Seen in traces** section in its panel: its span count and failure rate, the language
it is written in when the traces say, and one line per caller and per callee with call count, protocol and 95th
percentile latency. Each line opens the other service.

The top of the fraktul gets a summary: how many services and calls the traces hold, how much of that the fraktul draws, and
the list of what is missing.

## Start from the traces

No map yet? Print the observed service graph as a Mermaid flowchart and use it as the first draft of your top level:

```bash
fraktul traces http://jaeger.internal:16686 --mermaid
```

```text
flowchart LR
  checkout["checkout"]
  payment["payment"]
  postgresql[("postgresql")]:::data
  checkout -- "gRPC" --> payment
  checkout -- "queries" --> postgresql
```

It is a draft, not a diagram: it has every service at one level and no words. Group the services, name the groups,
write the summaries. Or ask [your assistant](/docs/ai) to.

## Keep it fresh

Traces describe the system as it ran when you read them. Read them again on a schedule (weekly is enough for most
teams, or after each release), commit the new `traces.json`, and let the check tell you what changed:

```yaml
# .github/workflows/map-traces.yml
on:
  schedule: [{ cron: "0 6 * * 1" }]
jobs:
  traces:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx fraktul traces "$JAEGER_URL" --lookback 7d
        env: { JAEGER_URL: "${{ secrets.JAEGER_URL }}" }
      - run: npx fraktul check --strict
```

## What it reads

| From the span | fraktul uses it for |
|---|---|
| `service.name` (resource) | Which service the span belongs to |
| parent span in another service | One call from that service to this one |
| `rpc.system`, `http.*`, `messaging.system` | How the call travelled: gRPC, HTTP, a queue |
| `db.system`, `messaging.system`, `peer.service` on a client span with no child elsewhere | A database, cache, queue or outside service |
| status, start and end time | Failures and latency |
| `telemetry.sdk.language` (resource) | The language shown in the panel |

Sampled traces are fine: counts are then counts of what was sampled, and the list of who calls whom is what
matters.
