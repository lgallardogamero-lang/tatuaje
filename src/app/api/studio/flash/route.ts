import { HttpError, requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { addFlash, overview, requireMember } from "@/lib/studio";
import { MAX_IMAGE_BYTES, STYLES } from "@/lib/config";

/** Lista el catálogo (lo usa el asistente en modo estudio). */
export const GET = handle(async () => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  return json({ flash: (await overview(m.orgId)).flash });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  const form = await req.formData();
  const file = form.get("file");
  const name = form.get("name");
  const style = form.get("style");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Falta la imagen del diseño");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "La imagen pesa demasiado (máximo 12 MB)");
  if (typeof name !== "string") throw new HttpError(400, "Falta el nombre");
  const styleId = typeof style === "string" && STYLES.some((s) => s.id === style) ? style : undefined;
  const id = await addFlash(m, { name, style: styleId, bytes: new Uint8Array(await file.arrayBuffer()) });
  return json({ id }, 201);
});
