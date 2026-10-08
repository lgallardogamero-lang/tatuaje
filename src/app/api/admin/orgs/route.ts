import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { createOrg } from "@/lib/admin";

const body = z.object({
  name: z.string().max(80),
  city: z.string().max(60),
  ownerEmail: z.string().email().max(254),
  plan: z.enum(["none", "basic", "pro", "premium"]),
});

export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  const id = await createOrg(admin, body.parse(await readJson(req)));
  return json({ id }, 201);
});
