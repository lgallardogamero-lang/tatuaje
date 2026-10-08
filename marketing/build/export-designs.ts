// Exporta los diseños de ejemplo del proveedor simulado como SVG sueltos: `npm run marketing:disenos`
import fs from "node:fs";
import { designSvg } from "../../src/lib/providers/mock";

const set: [string, string, string, "bw" | "color"][] = [
  ["luna", "luna", "minimalista", "bw"],
  ["rama", "rama", "fine-line", "bw"],
  ["corazon", "corazon", "old-school", "color"],
  ["sol", "sol", "blackwork", "bw"],
  ["olas", "ola", "japones", "color"],
  ["rosa", "rosa", "realista", "bw"],
  ["rosa-color", "rosa", "neotradicional", "color"],
  ["mandala", "lobo", "geometrico", "bw"],
];
for (const [file, seed, style, color] of set) fs.writeFileSync(`marketing/assets/${file}.svg`, designSvg(seed, style, color));
console.log("exportados", set.length);
