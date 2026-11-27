// The map page's one heading, for screen readers and search engines (the map draws its own title bar).
import { html } from "@bascik/bascik/html";
import { loadModel } from "./model.ts";

export default function () {
  return html`<h1 class="sr">${loadModel().title ?? "System map"}</h1>`;
}
