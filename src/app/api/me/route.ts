import { getUser } from "@/lib/auth";
import { balance } from "@/lib/credits";
import { handle, json } from "@/lib/api";
import { one } from "@/lib/db";

export const GET = handle(async () => {
  const user = await getUser();
  if (!user) return json({ user: null });
  const studio = await one<{ id: string; name: string; slug: string; role: string }>(
    "SELECT o.id, o.name, o.slug, m.role FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? LIMIT 1",
    user.id,
  );
  return json({ user, credits: await balance(user.id), studio });
});
