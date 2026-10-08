// Genera los carruseles como PNG 1080x1350 (formato vertical 4:5 de Instagram/TikTok fotos).
//   node marketing/build/carruseles.mjs  -> marketing/salida/carruseles/<nombre>/slide-NN.png
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const svg = (n) => fs.readFileSync(`${root}/assets/${n}.svg`, "utf8").replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
const fonts = fs.readFileSync(`${root}/lib/brand.css`, "utf8").split("\n").slice(0, 2).join("\n").replaceAll("../../node_modules", `file://${path.resolve(root, "..")}/node_modules`);

const css = `${fonts}
*{box-sizing:border-box;margin:0;padding:0}
body{width:540px;height:675px;overflow:hidden;font-family:"Hanken Grotesk",sans-serif}
.s{position:relative;width:540px;height:675px;padding:48px 44px;display:flex;flex-direction:column;justify-content:center}
.paper{background:#ece7dc;color:#0e1014}.dark{background:#0e1014;color:#ece7dc}.vio{background:#a58bff;color:#0e1014}
.d{font-family:"Gloock",serif;line-height:1.04;letter-spacing:-.01em}
.big{font-size:52px}.mid{font-size:38px}.sm{font-size:20px;line-height:1.35;font-weight:500;margin-top:18px;opacity:.85}
.n{position:absolute;top:30px;left:44px;font-size:13px;font-weight:700;letter-spacing:.14em;opacity:.55}
.foot{position:absolute;bottom:28px;left:44px;right:44px;display:flex;justify-content:space-between;font-size:12px;font-weight:600;opacity:.6}
.art{width:230px;height:230px;margin:0 auto 22px}.art svg{width:100%;height:100%}
.art.dk svg *{stroke:#ece7dc}
.tag{display:inline-block;margin-top:20px;padding:7px 14px;border:1px solid currentColor;border-radius:99px;font-size:13px;font-weight:700;opacity:.7}
.lg{display:inline-flex;align-items:center;gap:7px;opacity:1}.lg b{font-family:"Gloock",serif;font-size:20px;font-weight:400}.foot{opacity:.9}
.arm{position:relative;width:100%;height:300px;border-radius:14px;overflow:hidden;margin-bottom:22px;background:url("file://${root}/assets/brazo.jpg") 50% 62% / 100% auto no-repeat}
.arm::after{display:none;content:"";position:absolute;inset:0;background:radial-gradient(ellipse 60% 45% at 38% 30%,rgba(255,242,230,.28),rgba(255,242,230,0) 70%)}
.armtat{position:absolute;left:51%;top:50%;width:210px;height:210px;margin:-105px 0 0 -105px;z-index:1}.armtat svg{mix-blend-mode:multiply}
.armlab{position:absolute;left:12px;bottom:12px;z-index:2;font-size:12px;font-weight:700;color:#ece7dc;background:rgba(14,16,20,.74);padding:6px 11px;border-radius:99px}
.vio .lg svg path:first-child{stroke:#0e1014}.vio .lg svg circle{fill:#0e1014}.swipe{position:absolute;right:36px;bottom:26px;font-size:13px;font-weight:700}
`;

const LOGO = `<svg width="22" height="22" viewBox="0 0 26 26" fill="none"><path d="M4 20 L13 4 L22 20 Z" stroke="#a58bff" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 20 L13 12 L17.5 20" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="13" cy="4" r="1.6" fill="#a58bff"/></svg><b>Calco</b>`;
const arm = (n, label = "Simulación con IA") => `<div class="arm"><div class="armtat">${svg(n)}</div><span class="armlab">${label}</span></div>`;
const S = (cls, i, total, body, foot = "Calco") => `<div class="s ${cls}"><div class="n">${String(i).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>${body}<div class="foot"><span class="lg">${LOGO}</span>${i < total ? '<span>desliza →</span>' : ""}</div></div>`;

const carruseles = {
  "c1-el-tatuaje-que-no-me-hice": [
    ["paper", `<p class="d big">Lo tenía clarísimo.</p><p class="sm">Una luna pequeña, en la muñeca. Llevaba dos años pensándolo.</p>`],
    ["paper", `<div class="art">${svg("luna")}</div><p class="d mid">Tenía el diseño guardado en el móvil.</p>`],
    ["dark", `<p class="d big">Pero había una duda pequeña.</p><p class="sm">«¿Y si en mi piel no queda como en la foto?»</p>`],
    ["paper", `<p class="d mid">Pregunté a tres personas.</p><p class="sm">Tres respuestas distintas. Ninguna con mi muñeca delante.</p>`],
    ["dark", `${arm("leon")}<p class="d mid">Así que lo probé antes.</p><p class="sm">En una foto de mi brazo, con el tamaño real.</p>`],
    ["paper", `<p class="d mid">Y vi algo que no esperaba:</p><p class="d big" style="margin-top:14px">era demasiado pequeña.</p>`],
    ["vio", `<p class="d big">La hice un poco más grande.</p><p class="sm">Cambié de idea en 30 segundos. No en una sesión de dos horas.</p>`],
    ["dark", `<p class="d mid">Ese es el tatuaje que no me hice.</p><p class="sm">El que sí, salió mejor. Pruébatelo antes en <b>Calco</b>.</p><span class="tag">Relato ilustrativo · Simulación con IA</span>`],
  ],
  "c2-siete-cosas": [
    ["dark", `<p class="d big">7 cosas que nadie te cuenta antes de tatuarte.</p><span class="tag">guárdalo para después</span>`],
    ["paper", `<p class="d mid">1. El tamaño engaña.</p><p class="sm">En la pantalla todo parece del tamaño que quieras. En el brazo, no.</p>`],
    ["paper", `<p class="d mid">2. La línea fina se abre con los años.</p><p class="sm">Cuanto más detalle, más importa quién lo haga y dónde.</p>`],
    ["paper", `<p class="d mid">3. El color se ve distinto según tu piel.</p><p class="sm">Pregunta cómo se verá en la tuya, no en una foto de otra.</p>`],
    ["paper", `<p class="d mid">4. Una zona que se mueve, deforma el dibujo.</p><p class="sm">Codos, muñecas, costillas. Piénsalo con el cuerpo en movimiento.</p>`],
    ["paper", `<p class="d mid">5. Un tatuaje recién hecho no es el final.</p><p class="sm">Cicatrizado se ve diferente. Pregunta por el resultado curado.</p>`],
    ["paper", `<p class="d mid">6. Un buen tatuador te dirá que no.</p><p class="sm">Si te dice que ese diseño no funcionará ahí, escúchale.</p>`],
    ["vio", `<p class="d mid">7. Puedes verlo antes.</p><p class="sm">Sube tu foto, elige el diseño y mira la simulación. Es orientativa: lo definitivo lo decide tu tatuador.</p><span class="tag">Calco · Simulación con IA</span>`],
  ],
  "c3-estilos-en-una-frase": [
    ["dark", `${arm("leon", "Ejemplo ilustrativo")}<p class="d mid">Estilos de tatuaje, en una frase.</p>`],
    ["paper", `<div class="art">${svg("luna")}</div><p class="d mid">Línea fina</p><p class="sm">Trazo delicado, pocos elementos, mucho aire.</p>`],
    ["paper", `<div class="art">${svg("rama")}</div><p class="d mid">Botánico</p><p class="sm">Hojas y ramas que siguen la forma del brazo.</p>`],
    ["paper", `<div class="art">${svg("corazon")}</div><p class="d mid">Tradicional</p><p class="sm">Contorno marcado, formas claras, se lee de lejos.</p>`],
    ["paper", `<div class="art">${svg("sol")}</div><p class="d mid">Geométrico</p><p class="sm">Simetría y repetición. Cada línea cuenta.</p>`],
    ["paper", `<div class="art">${svg("olas")}</div><p class="d mid">Minimalista</p><p class="sm">Una idea, un gesto. Nada más.</p>`],
    ["paper", `<div class="art">${svg("rosa")}</div><p class="d mid">Ilustrativo</p><p class="sm">Sombras y volumen, como un dibujo a tinta.</p>`],
    ["vio", `<p class="d mid">¿Cuál va contigo?</p><p class="sm">Pruébalo en tu foto antes de decidir. Comenta el estilo y lo probamos.</p><span class="tag">Calco · Simulación con IA</span>`],
  ],
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await (await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 })).newPage();
for (const [name, slides] of Object.entries(carruseles)) {
  const dir = `${root}/salida/carruseles/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < slides.length; i++) {
    const [cls, body] = slides[i];
    const tmp = `${root}/salida/_slide.html`;
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${css}</style>${S(cls, i + 1, slides.length, body)}`);
    await page.goto(`file://${tmp}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/slide-${String(i + 1).padStart(2, "0")}.png` });
  }
  console.log(name, slides.length, "diapositivas");
}
fs.rmSync(`${root}/salida/_slide.html`, { force: true });
await browser.close();
