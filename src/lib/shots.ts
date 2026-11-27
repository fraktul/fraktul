// The screenshots of the live map that fraktul.dev shows (scripts/site-shots.ts takes them). Each one is a deep link
// into /map, so a page can show the picture and offer "open this view live" with the same address.
export type Shot = { id: string; link: string; alt: string; hover?: string; /** The map the shot is of: fraktul's own (/map, the default) or the demo shop's (/shop/). */ map?: string };

export const SHOTS: Shot[] = [
  { id: "top", link: "#fraktul", alt: "The top level of a map: six blocks joined by arrows, with a panel describing the system" },
  { id: "inside", link: "#check/refs", alt: "One level down: the steps of the check, with one box selected and its details in the panel" },
  { id: "peek", link: "#fraktul", hover: "Check", alt: "Hovering a block shows its summary and a small copy of the diagram inside it" },
  { id: "tour", link: "#fraktul?tour=how-it-works&step=2", alt: "A tour stop: one block lit up, with the tour card explaining it and a Next button" },
  { id: "groups", link: `#${encodeURIComponent("file:fraktul:src/components/fraktul-map/fraktul-map.ts")}`, alt: "A file of more than a hundred functions drawn as eighteen named groups with a few lines between them" },
  { id: "group", link: `#${encodeURIComponent("part:fraktul:src/components/fraktul-map/fraktul-map.ts#drawing")}`, alt: "One group opened: its functions, the calls between them, and the neighbouring groups as single boxes" },
  { id: "source", link: `#${encodeURIComponent("fn:fraktul:src/lib/check.ts#checkModel")}`, alt: "A function level: who calls it, what it calls, and its source code in the panel" },
  { id: "traces", map: "/shop/", link: "#shop/checkout", alt: "A service selected on a map of an online shop; its panel lists the services that call it and the ones it calls, with call counts and latency from traces" },
  { id: "shop", map: "/shop/", link: "#shop", alt: "The top level of a map of an online shop: a customer, the storefront, a dozen services, a database and a queue" },
  { id: "3d", link: "#fraktul?view=3d", alt: "The same level in 3D, seen from the ground: blocks stand as towers, gears and screens, joined by arcs of light" },
  { id: "3d-bird", link: "#check?view=3d&cam=bird", alt: "A level in 3D from a bird's eye view, looking down across the blocks" },
];
