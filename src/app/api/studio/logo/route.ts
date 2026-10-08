import { HttpError, requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { logoOf, MAX_LOGO_BYTES, removeLogo, requireMember, setLogo } from "@/lib/studio";
import { getObject } from "@/lib/storage";

const headers = (type: string) => ({
  "Content-Type": type,
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
});

/** Logo del estudio para sus miembros (vista previa del panel). */
export const GET = handle(async () => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  const l = await logoOf(m.orgId);
  const obj = l ? await getObject(l.key) : null;
  if (!obj) throw new HttpError(404, "Sin logo");
  return new Response(obj.bytes as BodyInit, { headers: headers(obj.contentType) });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const m = await requireMember(user.id, true);
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Falta la imagen del logo");
  if (file.size > MAX_LOGO_BYTES) throw new HttpError(400, "El logo pesa demasiado (máximo 1 MB)");
  await setLogo(m, new Uint8Array(await file.arrayBuffer()));
  return json({ ok: true }, 201);
});

export const DELETE = handle(async () => {
  const user = await requireUser();
  await removeLogo(await requireMember(user.id, true));
  return json({ ok: true });
});
