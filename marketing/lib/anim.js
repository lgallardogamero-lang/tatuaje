// Utilidades de animación: todo es una función pura del tiempo t (segundos), para renderizar fotograma a fotograma.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));           // progreso 0..1 del tramo [a, b]
const lerp = (a, b, x) => a + (b - a) * x;
const E = {
  lin: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  soft: (x) => x * x * (3 - 2 * x),
  back: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const rgb = (c) => { if (c.startsWith("#")) { let h = c.slice(1); if (h.length === 3) h = [...h].map((x) => x + x).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
const mix = (a, b, x) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], x))).join(",")})`; };

/** Un tatuaje que se calca en violeta de stencil y se asienta como tinta. */
class Ink {
  constructor(svg, { boost = 1.35, stencil = "#a58bff" } = {}) {
    this.stencil = stencil;
    this.shapes = [...svg.querySelectorAll("path,line,circle,ellipse,polygon,polyline,rect")].filter((s) => !s.closest("defs")).map((el) => {
      const cs = getComputedStyle(el);
      el.setAttribute("pathLength", "1");
      return { el, stroke: cs.stroke, fill: cs.fill, fo: parseFloat(cs.fillOpacity || "1"), so: parseFloat(cs.strokeOpacity || "1"), sw: parseFloat(cs.strokeWidth) * boost, dash: el.getAttribute("stroke-dasharray") };
    });
  }
  /** draw: 0..1 trazo; settle: 0..1 de violeta a tinta y relleno. */
  set(draw, settle = 0) {
    const n = this.shapes.length, ov = Math.min(4, Math.max(1, n / 3));
    this.shapes.forEach((s, i) => {
      const lp = clamp((draw * (n + ov - 1) - i) / ov);
      const hasStroke = s.stroke !== "none" && s.stroke !== "";
      const hasFill = s.fill !== "none" && s.fill !== "";
      s.el.style.strokeWidth = s.sw;
      if (hasStroke) {
        s.el.style.strokeDasharray = settle >= 1 && s.dash ? s.dash : "1 1";
        s.el.style.strokeDashoffset = settle >= 1 && s.dash ? 0 : 1 - lp;
        s.el.style.stroke = mix(this.stencil, s.stroke, E.soft(settle));
        s.el.style.strokeOpacity = lp > 0 ? s.so : 0;
      } else s.el.style.strokeOpacity = 0;
      if (hasFill) { s.el.style.fillOpacity = s.fo * E.soft(settle); } 
    });
  }
}

/** Escribe texto como una máquina de escribir; devuelve la parte visible. */
const typed = (text, p) => text.slice(0, Math.floor(clamp(p) * text.length));
/** Aparece con un pequeño deslizamiento hacia arriba. */
function reveal(el, t, a, b, { dy = 18 } = {}) {
  const p = E.out(seg(t, a, b));
  el.style.opacity = p;
  el.style.transform = `translateY(${(1 - p) * dy}px)`;
}
function hide(el, t, a, b) { el.style.opacity = Math.min(parseFloat(el.style.opacity || 1), 1 - E.in(seg(t, a, b))); }
