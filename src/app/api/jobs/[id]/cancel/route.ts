import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { cancelJob } from "@/lib/jobs";

export const POST = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const ok = await cancelJob(id!, user.id);
  return json({ ok });
});
