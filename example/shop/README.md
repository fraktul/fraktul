# The demo shop

A map of a real system: the [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo) ("Astronomy
Shop"), an online shop made of about twenty services in a dozen languages. It is the system many people already use
to try out observability tools, so you may know it.

The map is live at [fraktul.dev/shop](https://fraktul.dev/shop/). It shows what fraktul's own map cannot:

- **Every level.** The system from 30,000 feet, the features (browsing, the cart, paying, delivery), each service,
  then the code.
- **Traces.** `traces.json` was read from the running shop. Each service's panel shows who really calls it, how
  often and how fast, and `fraktul check` compares those calls with the arrows in the diagrams.
- **Tours.** "The shop in two minutes" explains the system to someone who has never seen the code; "Follow one
  order" walks a purchase through the services.

| File | What it is |
|---|---|
| `model.yaml` | The map: 26 blocks, 9 diagrams, 2 tours |
| `traces.json` | What the traces saw: 17 services and 24 kinds of call between them, from 315 traces |
| `setup.sh` | Fetches the demo's source, for the code levels |
| `capture.sh` | Runs the shop in Docker and reads fresh traces |
| `otelcol-extras.yml` | The one Collector setting `capture.sh` adds: export traces to a file |

## See the map (no Docker)

In a checkout of fraktul:

```bash
npm ci
npm run shop:setup     # clones the demo's source into .demo/ (about 60 MB)
npm run shop:dev       # the map at http://localhost:8094
npm run shop:check     # the model against the code and the traces
```

Without `shop:setup` the map still works, down to the service level; the code levels need the source.

From the npm package, without the fraktul repo: clone the demo, then let fraktul put the model in it.

```bash
git clone --depth 1 --branch 2.1.3 https://github.com/open-telemetry/opentelemetry-demo.git
cd opentelemetry-demo
npx fraktul example shop     # writes docs/arch/model.yaml and docs/arch/traces.json
npx fraktul check
npx fraktul dev
```

## Run the shop and read your own traces

Needs Docker with Compose, about 8 GB of memory for the containers, and several GB of disk for the images.

```bash
npm run shop:traces                  # start the shop, shop for 4 minutes, write traces.json, stop
MINUTES=10 npm run shop:traces       # longer: more traces, rarer calls
KEEP=1 npm run shop:traces           # leave it running: the shop at http://localhost:8080
```

`capture.sh` adds a `file` exporter to the demo's Collector so every span is also written as OTLP JSON, then runs
`fraktul traces` on that file. With the shop still running you can read from its Jaeger instead:

```bash
node bin/fraktul.ts traces http://localhost:8080/jaeger/ui --model example/shop/model.yaml
```

Then try what the check is for. Delete an arrow from a diagram in `model.yaml` (say `shipping --> quote` under
`delivery`) and run `npm run shop:check`:

```text
Against the traces: 1 call not drawn, 0 services not on the map
  call     Shipping → Shipping quotes happens (6 calls in the traces) but no diagram draws shipping --> quote
```

## Notes

- The model was written for the demo's release 2.1.3. A newer release may have moved files; `shop:check` will say
  which.
- A short capture misses rare calls. The check lists three arrows the traces never showed (the storefront asking
  for a currency list, a shipping quote and product photos); they are real, just not in four minutes of traffic.
- The demo is Apache-2.0 licensed and is not part of fraktul. Only this map of it is.
