---
title: The demo shop
summary: A map of a real system of twenty services, with its traces. Look at it live, run it yourself, and break it to see the check work.
section: Start
---
fraktul's [own map](/map) is one small tool. To show what a map of a real system looks like, there is a second one:
[the demo shop](/shop/).

It maps the [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo), an open-source online shop
that many teams already use to try out observability tools. About twenty services in a dozen languages, a
database, a cache and a queue.

## What to look at

- **[The top level](/shop/#shop):** nine boxes. A shopper, the storefront, and the six things the shop does.
- **[A feature](/shop/#delivery):** delivery, and the three services that make it happen.
- **[A service](/shop/#checkout):** checkout, the conductor, and the eight calls it makes for every order.
- **[Real traffic](/shop/#shop/checkout):** select checkout and its panel lists who calls it and what it calls,
  with counts and latency from traces.
- **[A tour](/shop/#shop?tour=the-shop-in-two-minutes&step=1):** the shop in two minutes, for someone who has
  never seen the code.
- **Code:** open the storefront, then one of its API routes, then a function.

## Run it yourself

You need Node 24.21 or newer and git. No Docker.

```bash
git clone --depth 1 --branch 2.1.3 https://github.com/open-telemetry/opentelemetry-demo.git
cd opentelemetry-demo
npx fraktul example shop
npx fraktul check
npx fraktul dev
```

`fraktul example shop` writes the map's two files into the demo's checkout: `docs/arch/model.yaml` (the map) and
`docs/arch/traces.json` (what its traces saw). Open [http://localhost:8080](http://localhost:8080).

## Break it

The point of fraktul is that the map fails when it is wrong. Try it.

**Move a file.** Rename `src/payment/charge.js`, `git add` the change, and run the check:

```text
1 broken reference:
  ✗ node payment: file src/payment/charge.js is not in the repo (moved, renamed, deleted, or not tracked by git)
```

**Forget an arrow.** In `docs/arch/model.yaml`, delete the line `shipping -- "price for this many items" --> quote`
from the `delivery` block's diagram. The traces know better:

```text
Against the traces: 1 call not drawn, 0 services not on the map
  call     Shipping → Shipping quotes happens (6 calls in the traces) but no diagram draws shipping --> quote
```

## Run the shop too

To read fresh traces you need the shop itself running, which needs Docker with Compose and about 8 GB of memory.
The demo's own instructions are at
[opentelemetry.io/docs/demo](https://opentelemetry.io/docs/demo/docker-deployment/). Once it is up, with its load
generator shopping:

```bash
npx fraktul traces http://localhost:8080/jaeger/ui
npx fraktul check
```

[Traces](/docs/traces) explains what is read and how the check uses it.

## How this map was made

The way the [skill](/docs/ai) tells an assistant to: read the README and the compose file, find the handful of
things the shop does, write one block per feature and per service with a summary a shopper would understand, then
run the check until every file it named was real. The traces came last, to confirm the arrows.
