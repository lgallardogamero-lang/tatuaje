import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { createRequest } from "@/lib/studio-requests";

const body = z.object({
  name: z.string().max(80),
  city: z.string().max(60),
  contactEmail: z.string().max(254),
  instagram: z.string().max(40).optional(),
  plan: z.enum(["basic", "pro", "premium"]),
  message: z.string().max(600).optional(),
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const id = await createRequest(user, body.parse(await readJson(req)));
  return json({ id }, 201);
});
