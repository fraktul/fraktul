// npm run release [-- --dry-run]
// Tags origin/main with v<version from origin/main's package.json> and pushes the tag; release.yml then tests,
// builds and publishes to npm. Bump the version in a pull request first and merge it (RELEASING.md).
import { execFileSync } from "node:child_process";

const dry = process.argv.includes("--dry-run");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

git("fetch", "--quiet", "--tags", "origin", "main");
const version = JSON.parse(git("show", "origin/main:package.json")).version as string;
const tag = `v${version}`;
const sha = git("rev-parse", "origin/main");
if (git("tag", "--list", tag)) {
  console.error(`${tag} already exists. Bump "version" in package.json in a pull request, merge it, then run this again.`);
  process.exit(1);
}
console.log(`${dry ? "Would tag" : "Tagging"} ${tag} at origin/main (${sha.slice(0, 7)})${version.includes("-") ? `, dist-tag ${version.split("-")[1].split(".")[0]}` : ", dist-tag latest"}`);
if (dry) process.exit(0);
git("tag", "-a", tag, "-m", `fraktul ${version}`, sha);
git("push", "origin", tag);
console.log(`Pushed ${tag}. Follow it: gh run list --workflow release.yml --limit 1`);
