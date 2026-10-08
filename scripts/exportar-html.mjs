// Exporta páginas públicas a HTML autocontenido (sin JavaScript): para verlas o enseñarlas sin servidor.
//   npm run dev  (en otra terminal)  y luego  node scripts/exportar-html.mjs  ->  salida-html/*.html
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000";
const PAGES = { "/": "index", "/crear": "crear", "/estudios": "estudios", "/directorio": "directorio", "/precios": "precios", "/privacidad": "privacidad", "/terminos": "terminos", "/cookies": "cookies" };
fs.mkdirSync("salida-html", { recursive: true });
const mime = (u) => (u.endsWith(".woff2") ? "font/woff2" : u.endsWith(".woff") ? "font/woff" : u.endsWith(".svg") ? "image/svg+xml" : u.endsWith(".png") ? "image/png" : u.endsWith(".jpg") || u.endsWith(".jpeg") ? "image/jpeg" : u.endsWith(".webp") ? "image/webp" : "application/octet-stream");
const data = async (u) => {
  const r = await fetch(new URL(u, BASE));
  if (!r.ok) return null;
  return `data:${mime(u.split("?")[0])};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
};
for (const [route, name] of Object.entries(PAGES)) {
  const res = await fetch(BASE + route);
  if (!res.ok) { console.log("omitida", route, res.status); continue; }
  let html = await res.text();
  // CSS enlazado -> <style> con fuentes e imágenes incrustadas
  for (const m of [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?>/g)]) {
    const cssUrl = new URL(m[1], BASE);
    let css = await (await fetch(cssUrl)).text();
    for (const u of new Set([...css.matchAll(/url\(["']?([^)"']+\.woff2?)["']?\)/g)].map((x) => x[1]))) {
      if (u.startsWith("data:")) continue;
      if (u.endsWith(".woff")) { css = css.split(u).join("about:blank"); continue; }
      const d = await data(new URL(u, cssUrl).pathname); if (d) css = css.split(u).join(d);
    }
    html = html.replace(m[0], `<style>${css}</style>`);
  }
  html = html.replace(/<link[^>]*rel="preload"[^>]*>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<link[^>]*as="script"[^>]*>/g, "");
  for (const u of new Set([...html.matchAll(/(?:src|srcset)="(\/[^"\s]+\.(?:png|jpe?g|svg|webp))"/g)].map((x) => x[1]))) {
    const d = await data(u); if (d) html = html.split(`"${u}"`).join(`"${d}"`);
  }
  html = html.replace(/href="(\/[^"#?]*)"/g, (all, p) => (PAGES[p] ? `href="${PAGES[p]}.html"` : all));
  fs.writeFileSync(`salida-html/${name}.html`, html);
  console.log(route, "->", `salida-html/${name}.html`, (html.length / 1e3).toFixed(0), "KB");
}
