import { all, one, run, now } from "./db";
import { newId } from "./ids";
import { adminAdjust, balance } from "./credits";
import { deleteAccount, HttpError, normalizeEmail, type User } from "./auth";
import { purgeUserFiles } from "./jobs";
import { getPricing } from "./pricing";
import { STUDIO_PLANS, type StudioPlan } from "./config";

/** IVA general en España; los importes de venta incluyen IVA. */
export const VAT_RATE = 0.21;

export async function logAdmin(admin: Pick<User, "id" | "email">, action: string, target?: string, detail?: unknown) {
  await run(
    "INSERT INTO admin_log (id, admin_id, admin_email, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId(),
    admin.id,
    admin.email,
    action,
    target ?? null,
    detail === undefined ? null : JSON.stringify(detail),
    now(),
  );
}

export interface DayRow {
  day: string;
  revenueCents: number;
  jobs: number;
  failed: number;
  images: number;
  costCents: number;
}

export interface Dashboard {
  users: { total: number; last7: number; last30: number; banned: number };
  revenue: { totalCents: number; last30Cents: number; todayCents: number; netTotalCents: number; byProduct: { product: string; cents: number; count: number }[] };
  ai: { images: number; costCents: number; jobsDone: number; jobsFailed: number; unitCostCents: number };
  marginCents: number;
  creditsOutstanding: number;
  series: DayRow[];
  studios: { total: number; active: number };
}

const DAY = 86400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function dashboard(days = 14): Promise<Dashboard> {
  const t = now();
  const unit = (await getPricing()).aiUnitCostCents;
  const c = async (sql: string, ...a: unknown[]) => (await one<{ n: number | null }>(sql, ...a))?.n ?? 0;

  const revenueTotal = await c("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'paid'");
  const aiTotals = await one<{ images: number | null; done: number | null; failed: number | null }>(
    "SELECT SUM(images) AS images, SUM(jobs_done) AS done, SUM(jobs_failed) AS failed FROM usage_daily",
  );
  const images = aiTotals?.images ?? 0;
  const costCents = Math.round(images * unit);
  const netTotal = Math.round(revenueTotal / (1 + VAT_RATE));

  const since = dayKey(t - (days - 1) * DAY);
  const rev = await all<{ day: string; cents: number }>(
    "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, SUM(amount_cents) AS cents FROM purchases WHERE status = 'paid' GROUP BY day HAVING day >= ?",
    since,
  );
  const use = await all<{ day: string; jobs_done: number; jobs_failed: number; images: number }>("SELECT * FROM usage_daily WHERE day >= ?", since);
  const series: DayRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(t - i * DAY);
    const u = use.find((x) => x.day === day);
    const imgs = u?.images ?? 0;
    series.push({
      day,
      revenueCents: rev.find((x) => x.day === day)?.cents ?? 0,
      jobs: u?.jobs_done ?? 0,
      failed: u?.jobs_failed ?? 0,
      images: imgs,
      costCents: Math.round(imgs * unit),
    });
  }

  return {
    users: {
      total: await c("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL"),
      last7: await c("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND created_at > ?", t - 7 * DAY),
      last30: await c("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND created_at > ?", t - 30 * DAY),
      banned: await c("SELECT COUNT(*) AS n FROM users WHERE banned_at IS NOT NULL AND deleted_at IS NULL"),
    },
    revenue: {
      totalCents: revenueTotal,
      last30Cents: await c("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'paid' AND created_at > ?", t - 30 * DAY),
      todayCents: await c("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'paid' AND created_at >= ?", Date.parse(dayKey(t))),
      netTotalCents: netTotal,
      byProduct: await all<{ product: string; cents: number; count: number }>(
        "SELECT product, SUM(amount_cents) AS cents, COUNT(*) AS count FROM purchases WHERE status = 'paid' GROUP BY product ORDER BY cents DESC",
      ),
    },
    ai: { images, costCents, jobsDone: aiTotals?.done ?? 0, jobsFailed: aiTotals?.failed ?? 0, unitCostCents: unit },
    // Margen = ingresos sin IVA − coste estimado de IA (no descuenta comisiones de Stripe).
    marginCents: netTotal - costCents,
    creditsOutstanding: await c("SELECT SUM(delta) AS n FROM credit_ledger"),
    series,
    studios: {
      total: await c("SELECT COUNT(*) AS n FROM organizations"),
      active: await c("SELECT COUNT(*) AS n FROM organizations WHERE subscription_status = 'active'"),
    },
  };
}

export interface UserRow {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at: number;
  banned_at: number | null;
  credits: number;
  jobs: number;
  spent_cents: number;
}

export async function listUsers(q = "", page = 0, pageSize = 25): Promise<{ rows: UserRow[]; total: number }> {
  const like = `%${q.trim().toLowerCase().replace(/[%_]/g, "")}%`;
  const total = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND email LIKE ?", like))?.n ?? 0;
  const rows = await all<UserRow>(
    `SELECT u.id, u.email, u.role, u.created_at, u.banned_at,
       COALESCE((SELECT SUM(delta) FROM credit_ledger WHERE user_id = u.id), 0) AS credits,
       (SELECT COUNT(*) FROM credit_ledger WHERE user_id = u.id AND reason = 'generation') AS jobs,
       COALESCE((SELECT SUM(amount_cents) FROM purchases WHERE user_id = u.id AND status = 'paid'), 0) AS spent_cents
     FROM users u WHERE u.deleted_at IS NULL AND u.email LIKE ? ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    like,
    pageSize,
    page * pageSize,
  );
  return { rows, total };
}

export async function userDetail(id: string) {
  const user = await one<{ id: string; email: string; role: string; created_at: number; banned_at: number | null }>(
    "SELECT id, email, role, created_at, banned_at FROM users WHERE id = ? AND deleted_at IS NULL",
    id,
  );
  if (!user) return null;
  return {
    user,
    credits: await balance(id),
    ledger: await all<{ id: string; delta: number; reason: string; created_at: number }>("SELECT id, delta, reason, created_at FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 30", id),
    purchases: await all<{ id: string; product: string; amount_cents: number; status: string; created_at: number }>(
      "SELECT id, product, amount_cents, status, created_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      id,
    ),
  };
}

export type UserAction =
  | { action: "credits"; amount: number }
  | { action: "ban" }
  | { action: "unban" }
  | { action: "role"; role: "user" | "admin" }
  | { action: "purge_photos" }
  | { action: "delete" };

/** Acciones sobre un usuario. Todas quedan en el registro de auditoría. */
export async function userAction(admin: User, targetId: string, a: UserAction): Promise<void> {
  const target = await one<{ id: string; email: string; role: string }>("SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL", targetId);
  if (!target) throw new HttpError(404, "Usuario no encontrado");
  const self = target.id === admin.id;

  switch (a.action) {
    case "credits": {
      if (!Number.isInteger(a.amount) || a.amount === 0 || Math.abs(a.amount) > 1000) throw new HttpError(400, "Indica una cantidad entera entre -1000 y 1000, distinta de 0");
      if (a.amount < 0 && (await balance(targetId)) + a.amount < 0) throw new HttpError(400, "El usuario no tiene tantos créditos para retirar");
      await adminAdjust(targetId, a.amount, admin.id);
      break;
    }
    case "ban":
      if (self) throw new HttpError(400, "No puedes bloquearte a ti mismo");
      if (target.role === "admin") throw new HttpError(400, "Quita primero el rol de administrador");
      await run("UPDATE users SET banned_at = ? WHERE id = ?", now(), targetId);
      await run("DELETE FROM sessions WHERE user_id = ?", targetId);
      break;
    case "unban":
      await run("UPDATE users SET banned_at = NULL WHERE id = ?", targetId);
      break;
    case "role": {
      if (self) throw new HttpError(400, "No puedes cambiar tu propio rol");
      await run("UPDATE users SET role = ? WHERE id = ?", a.role, targetId);
      break;
    }
    case "purge_photos":
      await purgeUserFiles(targetId);
      break;
    case "delete":
      if (self) throw new HttpError(400, "Para borrar tu cuenta usa la página de cuenta");
      if (target.role === "admin") throw new HttpError(400, "Quita primero el rol de administrador");
      await purgeUserFiles(targetId);
      await deleteAccount(targetId);
      break;
  }
  await logAdmin(admin, `user.${a.action}`, target.email, "amount" in a ? { amount: a.amount } : "role" in a ? { role: a.role } : undefined);
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  plan: string;
  subscription_status: string;
  monthly_quota: number;
  listed: number;
  featured: number;
  members: number;
  used: number;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export async function listOrgs(): Promise<OrgRow[]> {
  const month = new Date().toISOString().slice(0, 7);
  return all<OrgRow>(
    `SELECT o.id, o.name, o.slug, o.city, o.plan, o.subscription_status, o.monthly_quota, o.listed, o.featured,
       (SELECT COUNT(*) FROM memberships WHERE org_id = o.id) AS members,
       COALESCE((SELECT used FROM org_usage WHERE org_id = o.id AND month = ?), 0) AS used
     FROM organizations o ORDER BY o.created_at DESC`,
    month,
  );
}

export async function createOrg(admin: User, input: { name: string; city: string; ownerEmail: string; plan: StudioPlan | "none" }): Promise<string> {
  const name = input.name.trim();
  const city = input.city.trim();
  if (name.length < 2 || name.length > 80 || city.length < 2 || city.length > 60) throw new HttpError(400, "Indica el nombre y la ciudad del estudio");
  const email = normalizeEmail(input.ownerEmail);
  const owner = await one<{ id: string }>("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", email);
  if (!owner) throw new HttpError(400, "El responsable debe tener ya una cuenta. Pídele que se registre primero");
  let slug = slugify(`${name}-${city}`) || newId().slice(0, 8);
  if (await one("SELECT 1 FROM organizations WHERE slug = ?", slug)) slug = `${slug}-${newId().slice(0, 4)}`;
  const id = newId();
  const plan = input.plan === "none" ? null : STUDIO_PLANS[input.plan];
  await run(
    `INSERT INTO organizations (id, name, slug, city, plan, subscription_status, monthly_quota, listed, featured, widget_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    slug,
    city,
    input.plan,
    plan ? "active" : "inactive",
    plan?.quota ?? 0,
    input.plan === "premium" ? 1 : 0,
    input.plan === "premium" ? 1 : 0,
    newId().replace(/-/g, ""),
    now(),
  );
  await run("INSERT INTO memberships (org_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)", id, owner.id, now());
  await logAdmin(admin, "org.create", name, { city, plan: input.plan, owner: email });
  return id;
}

export type OrgPatch = Partial<{ plan: StudioPlan | "none"; monthlyQuota: number; listed: boolean; featured: boolean; status: "active" | "inactive" }>;

export async function updateOrg(admin: User, id: string, p: OrgPatch): Promise<void> {
  const org = await one<{ name: string }>("SELECT name FROM organizations WHERE id = ?", id);
  if (!org) throw new HttpError(404, "Estudio no encontrado");
  if (p.plan !== undefined) {
    const plan = p.plan === "none" ? null : STUDIO_PLANS[p.plan];
    await run("UPDATE organizations SET plan = ?, monthly_quota = ?, subscription_status = ? WHERE id = ?", p.plan, plan?.quota ?? 0, plan ? "active" : "inactive", id);
  }
  if (p.monthlyQuota !== undefined) {
    if (!Number.isInteger(p.monthlyQuota) || p.monthlyQuota < 0 || p.monthlyQuota > 100_000) throw new HttpError(400, "Cupo no válido");
    await run("UPDATE organizations SET monthly_quota = ? WHERE id = ?", p.monthlyQuota, id);
  }
  if (p.listed !== undefined) await run("UPDATE organizations SET listed = ? WHERE id = ?", p.listed ? 1 : 0, id);
  if (p.featured !== undefined) await run("UPDATE organizations SET featured = ? WHERE id = ?", p.featured ? 1 : 0, id);
  if (p.status !== undefined) await run("UPDATE organizations SET subscription_status = ? WHERE id = ?", p.status, id);
  await logAdmin(admin, "org.update", org.name, p);
}

export async function deleteOrg(admin: User, id: string): Promise<void> {
  const org = await one<{ name: string }>("SELECT name FROM organizations WHERE id = ?", id);
  if (!org) throw new HttpError(404, "Estudio no encontrado");
  await run("DELETE FROM organizations WHERE id = ?", id);
  await logAdmin(admin, "org.delete", org.name);
}

export const recentLog = (limit = 100) =>
  all<{ id: string; admin_email: string; action: string; target: string | null; detail: string | null; created_at: number }>(
    "SELECT id, admin_email, action, target, detail, created_at FROM admin_log ORDER BY created_at DESC LIMIT ?",
    limit,
  );
