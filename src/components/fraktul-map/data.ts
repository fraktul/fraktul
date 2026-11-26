// Build-once script: the whole site's data (model, code, live facts) as one JSON block in the page.
import { html, json } from "@bascik/bascik/html";
import { buildSite } from "../../lib/build.ts";

export default async function () {
  return html`<script type="application/json" id="fraktul-data">${json(await buildSite())}</script>`;
}
