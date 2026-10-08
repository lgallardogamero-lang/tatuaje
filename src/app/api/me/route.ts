import { getUser } from "@/lib/auth";
import { balance } from "@/lib/credits";
import { handle, json } from "@/lib/api";
import { getMembership } from "@/lib/studio";

export const GET = handle(async () => {
  const user = await getUser();
  if (!user) return json({ user: null });
  const m = await getMembership(user.id);
  const studio = m ? { id: m.orgId, name: m.name, slug: m.slug, role: m.role, active: m.active, quota: m.quota, used: m.used } : null;
  return json({ user, credits: await balance(user.id), studio });
});
