import { deleteAccount, requireUser, destroySession } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { purgeUserFiles } from "@/lib/jobs";

export const DELETE = handle(async () => {
  const user = await requireUser();
  await purgeUserFiles(user.id);
  await deleteAccount(user.id);
  await destroySession();
  return json({ ok: true });
});
