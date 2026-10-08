import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { userAction } from "@/lib/admin";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("credits"), amount: z.number().int() }),
  z.object({ action: z.literal("ban") }),
  z.object({ action: z.literal("unban") }),
  z.object({ action: z.literal("role"), role: z.enum(["user", "admin"]) }),
  z.object({ action: z.literal("purge_photos") }),
  z.object({ action: z.literal("delete") }),
]);

export const POST = handle(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  await userAction(admin, id!, body.parse(await readJson(req)));
  return json({ ok: true });
});
