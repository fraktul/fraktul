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
Its code levels need the demo's source at `.demo/opentelemetry-demo` (git-ignored); CI fetches the pinned tag with
`npm run shop:setup` before building. Without the checkout the map still builds, with its service levels and traces but no code below them.

The shop's narration (`example/shop/.fraktul/voice/`) is committed, like the main map's, because CI cannot speak.
After changing a tour's `say:` text, run `node bin/fraktul.ts voice example/shop/model.yaml` on an Apple silicon Mac.

`example/shop/traces.json` was captured from the running demo. `npm run shop:traces` refreshes it: it starts the demo
in Docker, lets the load generator shop, reads the traces and stops it again (`example/shop/README.md`).

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
