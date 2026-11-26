// Preview deployments (FRAKTUL_PREVIEW=1) ask search engines not to index them; production is indexable.
import { html } from "@bascik/bascik/html";

export default function () {
  return process.env.FRAKTUL_PREVIEW ? html`<meta name="robots" content="noindex, nofollow" />` : html``;
}
