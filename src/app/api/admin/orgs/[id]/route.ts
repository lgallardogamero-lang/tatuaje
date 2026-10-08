import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { deleteOrg, updateOrg } from "@/lib/admin";

const patch = z.object({
  plan: z.enum(["none", "basic", "pro", "premium"]).optional(),
  monthlyQuota: z.number().int().optional(),
  listed: z.boolean().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const PATCH = handle(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  await updateOrg(admin, id!, patch.parse(await readJson(req)));
  return json({ ok: true });
});

export const DELETE = handle(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  await deleteOrg(admin, id!);
  return json({ ok: true });
});
