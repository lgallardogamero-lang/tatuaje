// Sustituye los marcadores __SVG:nombre__ de las escenas por el SVG de marketing/assets/nombre.svg
// (se ejecuta antes de grabar). Las escenas fuente están en marketing/escenas-src; las generadas, en marketing/escenas.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(`${root}/escenas`, { recursive: true });
for (const f of fs.readdirSync(`${root}/escenas-src`).filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(`${root}/escenas-src/${f}`, "utf8").replace(/__SVG:([a-z0-9-]+)__/g, (_, n) => fs.readFileSync(`${root}/assets/${n}.svg`, "utf8").replace(/<\?xml[^>]*>/, ""));
  fs.writeFileSync(`${root}/escenas/${f}`, html);
}
console.log("escenas generadas");
