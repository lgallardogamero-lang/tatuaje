// Sustituye los marcadores __SVG:nombre__ de las escenas por el SVG de marketing/assets/nombre.svg
// (se ejecuta antes de grabar). Las escenas fuente están en marketing/escenas-src; las generadas, en marketing/escenas.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(`${root}/escenas`, { recursive: true });
for (const f of fs.readdirSync(`${root}/escenas-src`).filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(`${root}/escenas-src/${f}`, "utf8").replace(/__SVG:([a-z0-9-]+)__/g, (_, n) => fs.readFileSync(`${root}/assets/${n}.svg`, "utf8").replace(/<\?xml[^>]*>/, ""));
  // Marca de agua con el logo de Calco (abajo a la derecha), dentro del escenario y por encima de todo.
  const logo = `<div style="position:absolute;right:22px;bottom:22px;z-index:99;display:flex;align-items:center;gap:7px;opacity:.9;pointer-events:none"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 20 L13 4 L22 20 Z" stroke="#a58bff" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 20 L13 12 L17.5 20" stroke="#ece7dc" stroke-width="1.2" stroke-linejoin="round"/><circle cx="13" cy="4" r="1.4" fill="#a58bff"/></svg><span style="font-family:Gloock,serif;font-size:22px;color:#ece7dc;text-shadow:0 1px 8px rgba(0,0,0,.6)">Calco</span></div>`;
  const i = html.indexOf("<script");
  const j = html.lastIndexOf("</div>", i);
  fs.writeFileSync(`${root}/escenas/${f}`, html.slice(0, j) + logo + html.slice(j));
}
console.log("escenas generadas");
