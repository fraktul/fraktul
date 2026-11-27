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

## Making the repository public

The repository's protections are written down in `.github/scripts/secure-repo.sh`. GitHub refuses some of them on a
private repository of a free organization, so the order matters:

1. Check what will become visible: every commit (author names and email addresses included), every past Actions
   log, every issue and pull request with its comments, and the Preview URLs in those comments.
2. Make the repository public (Settings, Danger Zone).
3. Straight away, run `.github/scripts/secure-repo.sh`. It adds what it had to skip: the rulesets on `main` and on
   `v*` tags, secret scanning with push protection, private vulnerability reporting, and approval for workflows on
   outside contributors' pull requests. It should end with "Every setting is applied."
4. Open a pull request from a fork (or ask someone to) and confirm it runs the tests, waits for approval first, and
   does not deploy.
5. Drop `FRAKTUL_PUBLIC=1` from the `site:build` scripts so fraktul's own map shows its source (DEPLOYMENT.md), and
   remove the `REPO_PRIVATE` note above once a release has published with provenance.

What the protections are:

| Protects | How |
|---|---|
| `main` | No deletion or force push. Changes arrive by pull request, with an approval from a code owner (`.github/CODEOWNERS`) and a passing `Test` check. Admins can bypass, so a sole maintainer can merge their own work. |
| Releases | Only an admin can create, move or delete a `v*` tag, and `release.yml` refuses a tag that is not on `main`. npm trusts only that workflow (trusted publishing): there is no npm token to steal. |
| Secrets | The Cloudflare token is used only by the deploy job, which runs only for pushes to this repository. Pull requests from forks run the tests with a read-only token and no secrets, after a maintainer approves the run. |
| Workflows | Only GitHub's own actions are allowed. The workflow token is read-only unless a job asks for more. CodeQL scans the workflows and the code. |
| Dependencies | Dependabot opens weekly, grouped updates after a seven-day cooldown, and security updates as they come. |
