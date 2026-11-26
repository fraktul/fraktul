// The preview alias for the current branch: lowercase letters, digits and dashes, short enough for a DNS label
// (`<alias>-fraktul.<subdomain>.workers.dev`). Uses GITHUB_HEAD_REF / GITHUB_REF_NAME on CI, else the local branch.
import { execFileSync } from "node:child_process";

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "") || "preview";
console.log(alias);
