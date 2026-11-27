# Releasing fraktul to npm

The package on npm is JavaScript: `scripts/build-package.ts` writes it to `package/` (Node does not strip TypeScript
inside node_modules). CI installs that package into an empty project and maps the example with it on every branch.

1. In a pull request, bump `version` in `package.json` (a prerelease is `1.1.0-rc.1`). CI must be green.
2. Merge it into `main`.
3. `npm run release` tags `origin/main` with `v<version>` and pushes the tag (`-- --dry-run` prints what it would do).
4. `release.yml` checks the tag is on main, runs the tests, builds the package and publishes it: a stable version under
   `latest`, a prerelease under the dist-tag named by its identifier (`rc`), never `latest`. It also creates the GitHub
   release. A version already on npm is skipped, so a rerun is safe.

## Trusted publishing (no npm token)

`release.yml` publishes with npm's OIDC trusted publishing, like Bascik's packages. npm only lets a package that
exists trust a workflow, so the very first version is published once by hand:

```bash
npx npm login
node --no-warnings scripts/build-package.ts && (cd package && npm publish --access public)
npx npm trust github fraktul --repo rinsesoft/fraktul --file release.yml --yes
```

After that, every tag publishes from CI, and nobody needs an npm token.

The first publish makes the code public on npm. fraktul's GitHub repo can stay private; the package cannot. npm only
attests provenance for a public repository, so `publish-npm.sh` leaves `--provenance` out while the repo is private
and adds it by itself once the repo is public.

## Before a release

- `CHANGELOG.md` has a section for the version.
- `npm test` and `npm run package` pass; CI installs the package into an empty project and builds a map with it.
- fraktul.dev's install instructions name the package, so publish soon after the site deploys.
