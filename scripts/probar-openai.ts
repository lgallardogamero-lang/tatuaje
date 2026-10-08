/**
 * Prueba CORTA y controlada del proveedor real de OpenAI, para comprobar calidad y coste antes de abrirlo al público.
 * Hace como máximo 2 llamadas (1 diseño + 1 aplicación sobre tu foto, calidad baja por defecto).
 *
 *   OPENAI_API_KEY=sk-... npm run probar:openai -- foto.jpg "un lobo geométrico en línea fina" --yes
 *
 * Sin --yes solo muestra lo que haría y NO llama a nada (no cuesta nada).
 * Opciones por variable de entorno: OPENAI_IMAGE_MODEL, OPENAI_IMAGE_QUALITY (low|medium|high).
 * Los resultados se guardan en ./salida-prueba/
 */
import fs from "node:fs";
import { OpenAIProvider } from "../src/lib/providers/openai";
import { buildApplyPrompt, buildDesignPrompt } from "../src/prompts/v1";
import { imageSize, sniffImageType } from "../src/lib/image-validation";
import { applyWatermark } from "../src/lib/watermark";
import { encodePng } from "../src/lib/png";

const args = process.argv.slice(2).filter((a) => a !== "--");
const yes = args.includes("--yes");
const [fotoPath, descripcion = "un lobo geométrico en línea fina, blanco y negro"] = args.filter((a) => a !== "--yes");
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const q = process.env.OPENAI_IMAGE_QUALITY;
const quality = q === "medium" || q === "high" ? q : "low";

if (!fotoPath || !fs.existsSync(fotoPath)) {
  console.error("Falta la foto. Uso: ... scripts/probar-openai.ts -- foto.jpg \"descripción\" --yes");
  process.exit(1);
}
const bytes = new Uint8Array(fs.readFileSync(fotoPath));
const type = sniffImageType(bytes);
if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
  console.error("La foto debe ser JPG, PNG o WEBP.");
  process.exit(1);
}
const dims = imageSize(bytes) ?? { width: 1024, height: 1024 };

console.log(`\nModelo: ${model} · calidad: ${quality}\nFoto: ${fotoPath} (${dims.width}×${dims.height})\nDiseño: "${descripcion}"`);
console.log("Hará 2 llamadas de pago: 1 para crear el diseño y 1 para aplicarlo sobre tu foto (1 variante).");
if (!yes) {
  console.log("\nNo se ha llamado a nada. Para ejecutarlo de verdad, añade --yes\n");
  process.exit(0);
}
if (!key) {
  console.error("Falta OPENAI_API_KEY.");
  process.exit(1);
}

const provider = new OpenAIProvider(key, model, quality, process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
fs.mkdirSync("salida-prueba", { recursive: true });
const t0 = Date.now();
const design = await provider.createDesign({ prompt: buildDesignPrompt({ description: descripcion, style: "geometrico", color: "bw", hasReference: false }), seed: descripcion, style: "geometrico", color: "bw" });
fs.writeFileSync("salida-prueba/1-diseno.png", design.bytes);
console.log(`✔ Diseño listo en ${((Date.now() - t0) / 1000).toFixed(1)} s → salida-prueba/1-diseno.png`);

// máscara de prueba: una elipse centrada (blanco = zona del tatuaje)
const mw = 256;
const mh = Math.round((256 * dims.height) / dims.width);
const m = new Uint8ClampedArray(mw * mh * 4);
for (let y = 0; y < mh; y++)
  for (let x = 0; x < mw; x++) {
    const inside = ((x - mw / 2) / (mw * 0.22)) ** 2 + ((y - mh / 2) / (mh * 0.3)) ** 2 < 1;
    m.set(inside ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * mw + x) * 4);
  }
const mask = { bytes: await encodePng({ width: mw, height: mh, data: m }), contentType: "image/png" };

const t1 = Date.now();
const [result] = await provider.applyToSkin({
  photo: { bytes, contentType: type },
  mask,
  design,
  prompt: buildApplyPrompt({ zone: "antebrazo", size: "mediano", color: "bw", style: "geometrico" }),
  variants: 1,
  placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 },
  seed: descripcion,
});
if (!result) throw new Error("El proveedor no devolvió ninguna imagen");
fs.writeFileSync("salida-prueba/2-resultado.png", result.bytes);
const marked = await applyWatermark(result);
fs.writeFileSync("salida-prueba/3-resultado-con-marca.png", marked.bytes);
console.log(`✔ Resultado listo en ${((Date.now() - t1) / 1000).toFixed(1)} s → salida-prueba/2-resultado.png y 3-resultado-con-marca.png`);
console.log("\nRevisa las imágenes: ¿el tatuaje parece tinta bajo la piel, respeta la luz y el tono? Mira también el gasto en el panel de OpenAI.\n");
