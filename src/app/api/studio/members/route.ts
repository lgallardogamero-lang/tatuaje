import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { addMember, requireMember } from "@/lib/studio";

export const POST = handle(async (req) => {
  const user = await requireUser();
  const owner = await requireMember(user.id, true);
  const { email } = z.object({ email: z.string().max(254) }).parse(await readJson(req));
  await addMember(owner, email);
  return json({ ok: true }, 201);
});
