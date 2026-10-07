import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { purgeUserFiles } from "@/lib/jobs";

/** "Borrar mis fotos": elimina ya todas las fotos y resultados del usuario. */
export const DELETE = handle(async () => {
  const user = await requireUser();
  const n = await purgeUserFiles(user.id);
  return json({ ok: true, deletedJobs: n });
});
