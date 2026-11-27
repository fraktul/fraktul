# fraktul

An explorable map of a software system: one model file, diagrams you click into down to the source, tours. The CLI
(`bin/fraktul.ts`) builds a [Bascik](https://bascik.dev) page; fraktul.dev is the same code built with `FRAKTUL_SITE=1`.

## Commands

```bash
npm ci
npm test                 # unit tests, then the example model's check
npm run dev              # the map of example/model.yaml (fraktul itself) on :8080
npm run site:dev         # fraktul.dev on :8095
npm run site:build       # fraktul.dev into site-dist/
npm run package          # the npm package (JavaScript) into package/
```

## Where things are

- `bin/fraktul.ts`: the CLI. `src/lib/`: model, code reader, check, build, grouping of big files, init.
- `src/components/fraktul-map/`: the map page (2D in `fraktul-map.ts`, 3D in `map3d.ts`); styles in `src/pages/css/`.
- `src/site/`, `src/components/*` (other than the map), `content/docs/`: fraktul.dev. Its head tags come from
  `src/lib/seo.ts`, the features page and home showcase from `src/lib/features.ts`.
- `example/model.yaml`: fraktul's own map. Every file under `src/lib`, `scripts` and `bin` must be mentioned in it
  (`fraktul check --strict`).

## House rules

- TypeScript with erasable syntax only (Node strips the types; no enums, no parameter properties).
- Bascik scopes `id` and `class` inside components. A link target another component points at needs
  `data-bascik-preserve="id"`; tests and scripts find elements by `data-testid`.
- Build markup with `html` from `@bascik/bascik/html`, never by joining strings.
- Plain words in docs and comments. Comments say why, not what.
- After changing the site: `npm run site:build`, then the link check and SEO audit CI runs
  (`node .claude/skills/bascik/scripts/check-links.mjs --dist site-dist --ignore /map --ignore /shop`,
  `node .claude/skills/bascik-seo/scripts/audit-seo.mjs --dist site-dist`).
- After changing how the map looks: retake the site's screenshots (`npm run site:shots -- <url>`).

## Security

`SECURITY.md` is the policy; `.github/scripts/secure-repo.sh` applies the repository's settings and rulesets
(RELEASING.md, "Making the repository public"). Workflows may use only GitHub's own actions, and a job that runs
code from a pull request must not have secrets or a writable token.

## Agent skills

The Bascik agent skills live in `.agents/skills/` and `.claude/skills/` (pinned in `skills-lock.json`): `bascik`,
`bascik-components`, `bascik-scripts`, `bascik-seo`, `bascik-testing` and others. Load the one for the area you touch.
