import { getEnv } from "./env";

export type ModerationResult = { ok: true } | { ok: false; reason: string };

/** Normaliza para evadir trucos simples: acentos, mayúsculas, leetspeak y separadores. */
export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4|@/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RULES: { reason: string; words: RegExp }[] = [
  {
    reason: "contenido sexual explícito",
    words: /\b(porno?|porn|xxx|sexo explicito|desnud[oa]s?|nude|naked|genitales|pene|vagina|polla|coño|follar|fucking|erotic[oa])\b/,
  },
  {
    reason: "menores",
    words: /\b(menor de edad|nino desnudo|nina desnuda|child nude|underage|loli|pedofil\w*|csam)\b/,
  },
  {
    reason: "odio o violencia",
    words: /\b(esvastica|swastika|nazi|heil hitler|kkk|supremac\w+ blanc\w+|matar a|gas a los|white power|genocidio de)\b/,
  },
];

/** Moderación local por palabras clave (rápida y gratuita). Es la primera barrera, no la única. */
export function moderateTextLocal(text: string): ModerationResult {
  const n = normalizeForModeration(text);
  for (const r of RULES) if (r.words.test(n)) return { ok: false, reason: r.reason };
  return { ok: true };
}

/**
 * Moderación remota opcional con la API de moderación de OpenAI (gratuita, requiere clave).
 * Sin clave devuelve ok: solo actúa la barrera local y la declaración de mayoría de edad.
 * Para imágenes admite `imageDataUrl`.
 */
export async function moderateRemote(input: { text?: string; imageDataUrl?: string }): Promise<ModerationResult> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY || env.PROVIDER === "mock") return { ok: true };
  const payload: unknown[] = [];
  if (input.text) payload.push({ type: "text", text: input.text });
  if (input.imageDataUrl) payload.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  if (payload.length === 0) return { ok: true };
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: payload }),
  });
  if (!res.ok) throw new Error(`Moderación no disponible (${res.status})`);
  const data = (await res.json()) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] };
  const r = data.results?.[0];
  if (!r?.flagged) return { ok: true };
  const c = r.categories;
  if (c["sexual/minors"]) return { ok: false, reason: "menores" };
  if (c["sexual"]) return { ok: false, reason: "contenido sexual explícito" };
  if (c["hate"] || c["hate/threatening"] || c["violence/graphic"] || c["violence"]) return { ok: false, reason: "odio o violencia" };
  return { ok: false, reason: "contenido no permitido" };
}

export async function moderate(input: { text?: string; imageDataUrl?: string }): Promise<ModerationResult> {
  if (input.text) {
    const local = moderateTextLocal(input.text);
    if (!local.ok) return local;
  }
  return moderateRemote(input);
}
