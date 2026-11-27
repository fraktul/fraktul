# Contributing

Thanks for helping with fraktul. Bug reports, docs fixes and focused pull requests are welcome.

## Before you start

- Search the [issues](https://github.com/rinsesoft/fraktul/issues) first.
- For a larger change, open an issue so we can agree on the approach before you write code.
- Report security problems privately. See [SECURITY.md](SECURITY.md).
- Everyone is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Set up

You need Node 24.21 or newer and git.

```sh
npm ci
npm test            # unit tests, then the checks of both example maps
npm run dev         # fraktul's own map on http://localhost:8080
npm run site:dev    # fraktul.dev on http://localhost:8095
```

[AGENTS.md](AGENTS.md) says where things are and lists the house rules. It is written for coding assistants and
reads just as well for people.

## Making a change

1. Write a failing test first, then the smallest change that makes it pass.
2. `npm test` must pass. It also checks fraktul's own map (`example/model.yaml`): a new file under `src/lib`,
   `scripts` or `bin` has to be mentioned there, which `node bin/fraktul.ts check example/model.yaml --strict` verifies.
3. Update the docs under `content/docs/` when behaviour changed, and add a bullet to [CHANGELOG.md](CHANGELOG.md)
   for anything a user would notice.
4. Open a pull request against `main` and fill in the template. Pull requests from forks run the tests; the preview
   deploy runs only for branches in this repository.

Write plain sentences. Comments say why, not what.

## Releases

Maintainers publish releases. See [RELEASING.md](RELEASING.md).
