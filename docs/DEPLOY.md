# Deploying fraktul.dev

fraktul.dev is one Cloudflare Worker, `fraktul`, serving the built site as static assets (`wrangler.jsonc`).
`.github/workflows/site.yml` builds and deploys it on every push:

| Push to | Build | Goes to |
|---|---|---|
| any branch except `main` | `npm run site:build:preview` (pages marked `noindex`) | a preview version at `https://<branch>-fraktul.<account>.workers.dev`, posted on the branch's pull request and in the run summary |
| `main` (a merged pull request) | `npm run site:build` (with sitemap and robots.txt for https://fraktul.dev) | production: https://fraktul.dev and https://www.fraktul.dev |

Both builds are public (`FRAKTUL_PUBLIC=1`): fraktul's own map on /map keeps its blocks, files, functions and who
calls whom, but leaves out source code and links into the private repo. Drop `FRAKTUL_PUBLIC=1` from the two
`site:build` scripts when the repo is opened up.

## One-time setup

1. Create a Cloudflare API token (Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare
   Workers" template), limited to the account that holds fraktul.dev, with these permissions:
   - Account · Workers Scripts · Edit
   - Zone · Workers Routes · Edit, for the fraktul.dev zone (the site is served by routes `fraktul.dev/*` and
     `www.fraktul.dev/*` on top of the zone's existing proxied DNS records)
2. Add it to the GitHub repo: `gh secret set CLOUDFLARE_API_TOKEN -R rinsesoft/fraktul`
3. If the token can see more than one Cloudflare account, also set the account:
   `gh variable set CLOUDFLARE_ACCOUNT_ID -R rinsesoft/fraktul --body <account id>`

Until the token exists the workflow still installs, tests and builds the site, then skips the deploy with a warning.

## From this Mac

```bash
npx wrangler login              # once
npm run deploy:preview          # this branch → its preview URL
npm run deploy                  # production (normally done by merging to main)
```
