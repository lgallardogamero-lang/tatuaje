import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { createLead } from "@/lib/studio";

const body = z.object({
  orgId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  kind: z.enum(["contact", "booking"]),
  message: z.string().max(500).optional(),
  consent: z.boolean(),
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = body.parse(await readJson(req));
  const id = await createLead({ userId: user.id, ...b });
  return json({ id }, 201);
});
