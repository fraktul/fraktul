# Deploying fraktul.dev

fraktul.dev is one Cloudflare Worker, `fraktul`, serving the built site as static assets (`wrangler.jsonc`), reached
through Worker routes `fraktul.dev/*` and `www.fraktul.dev/*` on top of the zone's existing proxied DNS records.
`.github/workflows/ci.yml` deploys it the same way Bascik's CI deploys bascik.dev:

| Push | What CI does |
|---|---|
| a branch other than `main` | runs the tests, builds the site (pages marked `noindex`), uploads a Preview version under one alias, `pr-<number>` when the branch has an open pull request (else the branch name): `https://pr-12-fraktul.<account>.workers.dev`. Smoke-tests it and render-tests it in Chromium (the map must draw), puts the URL in the run summary and in one comment on the pull request, updated on every push. |
| `main` | no tests (the pull request's branch was tested). Deploys production only when the commit came from a merged pull request and is still the newest commit on main, then smoke-tests and render-tests https://fraktul.dev. A commit pushed straight to main does not deploy. |
| a tag `v*.*.*` | `release.yml` publishes to npm (RELEASING.md). |

Both builds are public (`FRAKTUL_PUBLIC=1`): fraktul's own map on /map keeps its blocks, files, functions and who calls
whom, but leaves out source code and links into the repo. Drop it from the `site:build` scripts once the code is public.

## The demo shop (/shop/)

`npm run site:build` also builds `example/shop/model.yaml`, a map of the OpenTelemetry Demo, into `site-dist/shop/`.
Its code levels need the demo's source at `.demo/opentelemetry-demo` (git-ignored); CI clones the pinned tag before
building. Without the checkout the map still builds, with its service levels and traces but no code below them.

`example/shop/traces.json` was captured from the running demo. To refresh it: start the demo with Docker
(`docker compose up -d` in a checkout of the demo, with a `file` exporter added to its Collector), let the load
generator run for a few minutes, then `node bin/fraktul.ts traces <the exported file> --model example/shop/model.yaml`.

## Credentials

- Repository secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token for the account, with Account · Workers Scripts ·
  Edit and Zone · Workers Routes · Edit on fraktul.dev. The deploy job fails with a clear error without it.
- Repository variable `CLOUDFLARE_ACCOUNT_ID`: the account that owns the `fraktul` Worker.

## Manual Deploy in an Emergency

From a checkout of `main`, logged in with `npx wrangler login`:

```bash
npm run deploy            # production
npm run deploy:preview    # this branch's Preview (alias = branch name)
```
