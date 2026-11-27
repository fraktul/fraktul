# Security policy

## Reporting a vulnerability

Please report security problems privately. Do not open a public issue.

1. Open the [Security tab](https://github.com/rinsesoft/fraktul/security) of the repository.
2. Choose **Report a vulnerability** to start a private security advisory.
3. Describe the version, the impact, and the steps to reproduce.

A maintainer will reply. A confirmed issue is fixed in a patch release and credited in the advisory unless you ask
to stay anonymous.

## Supported versions

Only the latest release of `fraktul` on npm receives security fixes.

## Scope

In scope: the `fraktul` command line tool, the map page it builds, and what it reads and writes. Things worth
reporting include: a model file, source file or traces file that makes fraktul run code, read or write outside the
project, or put something into the built page that executes; a public build (`FRAKTUL_PUBLIC=1`) or a repo marked
`private: true` that leaks source; credentials from a git remote reaching the page or the logs.

Out of scope: vulnerabilities in a system you mapped with fraktul, and findings in dev-only dependencies that never
ship in the published package.

## What fraktul does with your code

It runs on your machine and sends nothing anywhere. The check, the build and the voice are local; the built map is a
static page that loads no code from a CDN. `fraktul traces` reads from the address or files you give it and keeps
only service names, call counts, error counts and latency.
