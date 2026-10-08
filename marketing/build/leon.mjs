// Dibuja un león de línea con melena de cientos de trazos (determinista) -> marketing/assets/leon.svg
import fs from "node:fs";
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const P = [];
const path = (d, w = 1.4, extra = "") => P.push(`<path d="${d}" fill="none" stroke="#161616" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`);
const cx = 256, cy = 262;
// melena: tres anillos de mechones en forma de llama, cada uno con su nervio central
for (const [n, r0, r1, w] of [[22, 96, 232, 1.8], [22, 94, 196, 1.5], [20, 92, 160, 1.3]]) {
  const off = n === 22 && r1 === 196 ? Math.PI / n : 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + off + (rnd() - 0.5) * 0.05;
    const half = (Math.PI / n) * 0.95;
    const len = r1 - r0 + (rnd() - 0.5) * 22;
    const sw = 0.55 + rnd() * 0.25;
    const pt = (ang, r) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 1.05];
    const [bx0, by0] = pt(a - half, r0), [bx1, by1] = pt(a + half, r0);
    const [tx, ty] = pt(a + sw * half * 2.2, r0 + len);
    const [m0x, m0y] = pt(a - half * 1.1, r0 + len * 0.55), [m1x, m1y] = pt(a + half * 1.5, r0 + len * 0.5);
    path(`M${bx0.toFixed(1)} ${by0.toFixed(1)} Q${m0x.toFixed(1)} ${m0y.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q${m1x.toFixed(1)} ${m1y.toFixed(1)} ${bx1.toFixed(1)} ${by1.toFixed(1)}`, w);
    const [nx, ny] = pt(a + half * 0.3, r0 + len * 0.4);
    path(`M${pt(a, r0 + 6)[0].toFixed(1)} ${pt(a, r0 + 6)[1].toFixed(1)} Q${nx.toFixed(1)} ${ny.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`, 0.8);
  }
}
// contorno de la cara
path(`M${cx} ${cy - 96} C${cx + 62} ${cy - 96} ${cx + 92} ${cy - 44} ${cx + 88} ${cy + 12} C${cx + 84} ${cy + 66} ${cx + 52} ${cy + 104} ${cx} ${cy + 112} C${cx - 52} ${cy + 104} ${cx - 84} ${cy + 66} ${cx - 88} ${cy + 12} C${cx - 92} ${cy - 44} ${cx - 62} ${cy - 96} ${cx} ${cy - 96} Z`, 2.4);
// frente y arrugas
path(`M${cx - 26} ${cy - 66} Q${cx} ${cy - 52} ${cx + 26} ${cy - 66}`, 1.4);
path(`M${cx} ${cy - 62} L${cx} ${cy - 30}`, 1.4);
for (const s of [-1, 1]) {
  // cejas y ojos
  path(`M${cx + s * 14} ${cy - 30} Q${cx + s * 40} ${cy - 50} ${cx + s * 66} ${cy - 30}`, 3);
  path(`M${cx + s * 22} ${cy - 18} Q${cx + s * 42} ${cy - 30} ${cx + s * 62} ${cy - 16} Q${cx + s * 42} ${cy - 6} ${cx + s * 22} ${cy - 18} Z`, 2);
  P.push(`<circle cx="${cx + s * 42}" cy="${cy - 17}" r="6.5" fill="#161616"/>`);
  // pliegues de la nariz a la boca
  path(`M${cx + s * 14} ${cy - 14} Q${cx + s * 28} ${cy + 20} ${cx + s * 34} ${cy + 46}`, 1.6);
  // hocico
  path(`M${cx + s * 6} ${cy + 36} C${cx + s * 34} ${cy + 36} ${cx + s * 50} ${cy + 52} ${cx + s * 42} ${cy + 70}`, 1.8);
  // bigotes: puntos
  for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) P.push(`<circle cx="${cx + s * (24 + k * 9)}" cy="${cy + 48 + j * 9 + k}" r="1.5" fill="#161616"/>`);
  // sombreado de la mejilla
  for (let k = 0; k < 7; k++) path(`M${cx + s * (50 + k * 4)} ${cy + 10 + k * 4} q${s * 10} 14 ${s * 2} 30`, 1);
}
// nariz
P.push(`<path d="M${cx - 22} ${cy + 6} Q${cx} ${cy - 2} ${cx + 22} ${cy + 6} L${cx + 8} ${cy + 30} Q${cx} ${cy + 36} ${cx - 8} ${cy + 30} Z" fill="#161616" stroke="#161616" stroke-width="2" stroke-linejoin="round"/>`);
// boca y barbilla
path(`M${cx} ${cy + 32} L${cx} ${cy + 50}`, 2);
path(`M${cx - 38} ${cy + 66} Q${cx - 18} ${cy + 84} ${cx} ${cy + 62} Q${cx + 18} ${cy + 84} ${cx + 38} ${cy + 66}`, 2.2);
path(`M${cx - 16} ${cy + 92} Q${cx} ${cy + 102} ${cx + 16} ${cy + 92}`, 1.4);
fs.writeFileSync(new URL("../assets/leon.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${P.join("")}</svg>`);
console.log("leon.svg", P.length, "trazos");
