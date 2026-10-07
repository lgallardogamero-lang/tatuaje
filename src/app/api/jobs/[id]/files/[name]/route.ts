import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getJob } from "@/lib/jobs";
import { hasEntitlement } from "@/lib/billing";
import { one } from "@/lib/db";
import { getObject } from "@/lib/storage";

/**
 * Sirve archivos del trabajo solo a su dueño:
 *  original            -> la foto subida (mientras no haya caducado)
 *  variant-N           -> con marca de agua; sin ella solo si compró HD
 *  design              -> con marca de agua; sin ella solo si compró el stencil
 */
export const GET = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id, name } = await params;
  const job = await getJob(id!, user.id);
  if (!job) throw new HttpError(404, "No encontrado");

  let kind: string;
  let position = 0;
  const m = /^variant-(\d)$/.exec(name!);
  if (name === "original") kind = "photo";
  else if (name === "design") kind = (await hasEntitlement(job.id, "stencil")) ? "design" : "design_wm";
  else if (m) {
    position = Number(m[1]);
    kind = (await hasEntitlement(job.id, "hd")) ? "variant" : "variant_wm";
  } else throw new HttpError(404, "No encontrado");

  const asset = await one<{ r2_key: string }>("SELECT r2_key FROM assets WHERE job_id = ? AND kind = ? AND position = ?", job.id, kind, position);
  const obj = asset ? await getObject(asset.r2_key) : null;
  if (!obj) throw new HttpError(404, "Este archivo ya se ha borrado");
  return new Response(obj.bytes as BodyInit, {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
});
