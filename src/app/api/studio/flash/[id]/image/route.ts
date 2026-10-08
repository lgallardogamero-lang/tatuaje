import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { requireMember } from "@/lib/studio";
import { one } from "@/lib/db";
import { getObject } from "@/lib/storage";

/** Imagen de un diseño del catálogo: solo para miembros del estudio dueño. */
export const GET = handle(async (_req, { params }) => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  const { id } = await params;
  const f = await one<{ r2_key: string }>("SELECT r2_key FROM flash_designs WHERE id = ? AND org_id = ?", id, m.orgId);
  const obj = f ? await getObject(f.r2_key) : null;
  if (!obj) throw new HttpError(404, "No encontrado");
  return new Response(obj.bytes as BodyInit, {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
});
