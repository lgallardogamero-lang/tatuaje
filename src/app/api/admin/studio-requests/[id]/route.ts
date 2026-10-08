import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { approveRequest, rejectRequest } from "@/lib/studio-requests";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), plan: z.enum(["none", "basic", "pro", "premium"]) }),
  z.object({ action: z.literal("reject"), reason: z.string().max(300).optional() }),
]);

export const POST = handle(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = body.parse(await readJson(req));
  if (b.action === "approve") return json({ orgId: await approveRequest(admin, id!, b.plan) });
  await rejectRequest(admin, id!, b.reason);
  return json({ ok: true });
});
