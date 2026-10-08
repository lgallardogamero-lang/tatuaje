import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { removeMember, requireMember } from "@/lib/studio";

export const DELETE = handle(async (_req, { params }) => {
  const user = await requireUser();
  const owner = await requireMember(user.id, true);
  const { id } = await params;
  await removeMember(owner, id!);
  return json({ ok: true });
});
