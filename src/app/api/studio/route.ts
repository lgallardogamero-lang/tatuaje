import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { overview, requireMember, updateStudioProfile } from "@/lib/studio";

export const GET = handle(async () => {
  const user = await requireUser();
  const m = await requireMember(user.id);
  return json({ role: m.role, ...(await overview(m.orgId)) });
});

const patch = z.object({
  city: z.string().max(60).optional(),
  contactEmail: z.string().max(254).optional(),
  instagram: z.string().max(40).optional(),
  listed: z.boolean().optional(),
});

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const m = await requireMember(user.id, true);
  await updateStudioProfile(m, patch.parse(await readJson(req)));
  return json({ ok: true });
});
