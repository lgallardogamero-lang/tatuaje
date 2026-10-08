import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { deleteFlash, requireMember } from "@/lib/studio";

export const DELETE = handle(async (_req, { params }) => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  const { id } = await params;
  await deleteFlash(m, id!);
  return json({ ok: true });
});
