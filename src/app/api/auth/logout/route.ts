import { destroySession } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export const POST = handle(async () => {
  await destroySession();
  return json({ ok: true });
});
