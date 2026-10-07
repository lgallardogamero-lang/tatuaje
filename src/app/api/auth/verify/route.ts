import { z } from "zod";
import { consumeMagicLink, createSession } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";

export const POST = handle(async (req) => {
  const { token } = z.object({ token: z.string().min(20).max(200) }).parse(await readJson(req));
  const user = await consumeMagicLink(token);
  await createSession(user.id);
  return json({ ok: true });
});
