import { all, one, run, now } from "./db";
import { newId } from "./ids";
import { HttpError, normalizeEmail } from "./auth";
import { validateImage } from "./image-validation";
import { moderateTextLocal } from "./moderation";
import { deleteObjects, putObject } from "./storage";
import { hit } from "./ratelimit";
import { slugify } from "./admin";

export const MAX_MEMBERS = 12;
export const MAX_FLASH = 100;

export interface Membership {
  orgId: string;
  role: "owner" | "artist";
  name: string;
  slug: string;
  city: string;
  plan: string;
  active: boolean;
  quota: number;
  used: number;
}

const monthKey = () => new Date().toISOString().slice(0, 7);

/** Estudio al que pertenece el usuario (el más reciente si hay varios). */
export async function getMembership(userId: string): Promise<Membership | null> {
  const r = await one<{ org_id: string; role: "owner" | "artist"; name: string; slug: string; city: string; plan: string; subscription_status: string; monthly_quota: number; used: number | null }>(
    `SELECT m.org_id, m.role, o.name, o.slug, o.city, o.plan, o.subscription_status, o.monthly_quota,
       (SELECT used FROM org_usage WHERE org_id = o.id AND month = ?) AS used
     FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 1`,
    monthKey(),
    userId,
  );
  if (!r) return null;
  return { orgId: r.org_id, role: r.role, name: r.name, slug: r.slug, city: r.city, plan: r.plan, active: r.subscription_status === "active", quota: r.monthly_quota, used: r.used ?? 0 };
}

export async function requireMember(userId: string, ownerOnly = false): Promise<Membership> {
  const m = await getMembership(userId);
  if (!m) throw new HttpError(403, "No perteneces a ningún estudio");
  if (ownerOnly && m.role !== "owner") throw new HttpError(403, "Solo el responsable del estudio puede hacer esto");
  return m;
}

export interface Overview {
  org: { id: string; name: string; slug: string; city: string; plan: string; active: boolean; listed: boolean; featured: boolean; quota: number; used: number; contact_email: string | null; instagram: string | null };
  members: { user_id: string; email: string; role: string }[];
  flash: { id: string; name: string; style: string | null; tried_count: number }[];
  leads: { id: string; kind: string; message: string | null; email: string; created_at: number }[];
  leadsTotal: number;
}

export async function overview(orgId: string): Promise<Overview> {
  const o = await one<{ id: string; name: string; slug: string; city: string; plan: string; subscription_status: string; listed: number; featured: number; monthly_quota: number; contact_email: string | null; instagram: string | null }>(
    "SELECT id, name, slug, city, plan, subscription_status, listed, featured, monthly_quota, contact_email, instagram FROM organizations WHERE id = ?",
    orgId,
  );
  if (!o) throw new HttpError(404, "Estudio no encontrado");
  const used = (await one<{ used: number }>("SELECT used FROM org_usage WHERE org_id = ? AND month = ?", orgId, monthKey()))?.used ?? 0;
  return {
    org: { id: o.id, name: o.name, slug: o.slug, city: o.city, plan: o.plan, active: o.subscription_status === "active", listed: Boolean(o.listed), featured: Boolean(o.featured), quota: o.monthly_quota, used, contact_email: o.contact_email, instagram: o.instagram },
    members: await all("SELECT m.user_id, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY m.role, u.email", orgId),
    flash: await all("SELECT id, name, style, tried_count FROM flash_designs WHERE org_id = ? ORDER BY created_at DESC", orgId),
    leads: await all(
      "SELECT l.id, l.kind, l.message, u.email, l.created_at FROM leads l JOIN users u ON u.id = l.user_id WHERE l.org_id = ? ORDER BY l.created_at DESC LIMIT 50",
      orgId,
    ),
    leadsTotal: (await one<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE org_id = ?", orgId))?.n ?? 0,
  };
}

export async function addMember(owner: Membership, rawEmail: string): Promise<void> {
  if (owner.role !== "owner") throw new HttpError(403, "Solo el responsable puede añadir tatuadores");
  const email = normalizeEmail(rawEmail);
  const u = await one<{ id: string }>("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND banned_at IS NULL", email);
  if (!u) throw new HttpError(400, "Esa persona aún no tiene cuenta en Calco. Pídele que se registre y vuelve a probar");
  const count = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ?", owner.orgId))?.n ?? 0;
  if (count >= MAX_MEMBERS) throw new HttpError(400, `Un estudio puede tener hasta ${MAX_MEMBERS} personas`);
  if (await one("SELECT 1 FROM memberships WHERE org_id = ? AND user_id = ?", owner.orgId, u.id)) throw new HttpError(400, "Ya forma parte del estudio");
  await run("INSERT INTO memberships (org_id, user_id, role, created_at) VALUES (?, ?, 'artist', ?)", owner.orgId, u.id, now());
}

export async function removeMember(owner: Membership, userId: string): Promise<void> {
  if (owner.role !== "owner") throw new HttpError(403, "Solo el responsable puede quitar personas");
  const target = await one<{ role: string }>("SELECT role FROM memberships WHERE org_id = ? AND user_id = ?", owner.orgId, userId);
  if (!target) throw new HttpError(404, "Esa persona no está en el estudio");
  if (target.role === "owner") throw new HttpError(400, "No se puede quitar al responsable del estudio");
  await run("DELETE FROM memberships WHERE org_id = ? AND user_id = ?", owner.orgId, userId);
}

export async function addFlash(m: Membership, input: { name: string; style?: string; bytes: Uint8Array }): Promise<string> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) throw new HttpError(400, "Ponle un nombre de hasta 60 caracteres");
  const mod = moderateTextLocal(name);
  if (!mod.ok) throw new HttpError(422, `Nombre no permitido: ${mod.reason}`);
  const v = validateImage(input.bytes);
  if (!v.ok) throw new HttpError(400, v.error);
  const total = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM flash_designs WHERE org_id = ?", m.orgId))?.n ?? 0;
  if (total >= MAX_FLASH) throw new HttpError(400, `El catálogo admite hasta ${MAX_FLASH} diseños`);
  const id = newId();
  const key = `org/${m.orgId}/flash/${id}`;
  await putObject(key, input.bytes, v.type);
  await run("INSERT INTO flash_designs (id, org_id, name, style, r2_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, m.orgId, name, input.style ?? null, key, v.type, now());
  return id;
}

export async function deleteFlash(m: Membership, id: string): Promise<void> {
  const f = await one<{ r2_key: string }>("SELECT r2_key FROM flash_designs WHERE id = ? AND org_id = ?", id, m.orgId);
  if (!f) throw new HttpError(404, "Diseño no encontrado");
  await deleteObjects([f.r2_key]);
  await run("DELETE FROM flash_designs WHERE id = ? AND org_id = ?", id, m.orgId);
}

export async function updateStudioProfile(m: Membership, p: Partial<{ city: string; contactEmail: string; instagram: string; listed: boolean }>): Promise<void> {
  if (m.role !== "owner") throw new HttpError(403, "Solo el responsable puede editar los datos del estudio");
  if (p.city !== undefined) {
    const c = p.city.trim();
    if (c.length < 2 || c.length > 60) throw new HttpError(400, "Indica la ciudad");
    await run("UPDATE organizations SET city = ? WHERE id = ?", c, m.orgId);
  }
  if (p.contactEmail !== undefined) {
    const e = p.contactEmail.trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new HttpError(400, "El email de contacto no es válido");
    await run("UPDATE organizations SET contact_email = ? WHERE id = ?", e || null, m.orgId);
  }
  if (p.instagram !== undefined) {
    const i = p.instagram.trim().replace(/^@/, "");
    if (i && !/^[a-zA-Z0-9._]{1,30}$/.test(i)) throw new HttpError(400, "El usuario de Instagram no es válido");
    await run("UPDATE organizations SET instagram = ? WHERE id = ?", i || null, m.orgId);
  }
  if (p.listed !== undefined) {
    if (p.listed && !m.active) throw new HttpError(400, "Necesitas un plan activo para aparecer en el directorio");
    await run("UPDATE organizations SET listed = ? WHERE id = ?", p.listed ? 1 : 0, m.orgId);
  }
}

export interface DirectoryStudio {
  id: string;
  name: string;
  slug: string;
  city: string;
  instagram: string | null;
  featured: boolean;
}

export async function directory(citySlug?: string): Promise<{ studios: DirectoryStudio[]; cities: { city: string; slug: string; count: number }[] }> {
  const rows = await all<{ id: string; name: string; slug: string; city: string; instagram: string | null; featured: number }>(
    "SELECT id, name, slug, city, instagram, featured FROM organizations WHERE listed = 1 AND subscription_status = 'active' ORDER BY featured DESC, name",
  );
  const cities = new Map<string, { city: string; slug: string; count: number }>();
  for (const r of rows) {
    const s = slugify(r.city);
    const c = cities.get(s) ?? { city: r.city, slug: s, count: 0 };
    c.count++;
    cities.set(s, c);
  }
  return {
    studios: rows.filter((r) => !citySlug || slugify(r.city) === citySlug).map((r) => ({ ...r, featured: Boolean(r.featured) })),
    cities: [...cities.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
  };
}

/** Contacto de un usuario con un estudio: exige consentimiento expreso y queda registrado para facturar al estudio. */
export async function createLead(input: { userId: string; orgId: string; jobId?: string; kind: "contact" | "booking"; message?: string; consent: boolean }): Promise<string> {
  if (input.consent !== true) throw new HttpError(400, "Debes aceptar compartir tu email con el estudio para contactar");
  const org = await one<{ name: string }>("SELECT name FROM organizations WHERE id = ? AND listed = 1 AND subscription_status = 'active'", input.orgId);
  if (!org) throw new HttpError(404, "Este estudio no está disponible");
  const message = (input.message ?? "").trim().slice(0, 500);
  if (message) {
    const mod = moderateTextLocal(message);
    if (!mod.ok) throw new HttpError(422, `No podemos enviar ese mensaje: ${mod.reason}`);
  }
  if (!(await hit(`lead:${input.userId}`, 5, 24 * 3600_000))) throw new HttpError(429, "Has contactado con muchos estudios hoy. Prueba mañana");
  if (!(await hit(`lead:${input.userId}:${input.orgId}`, 1, 24 * 3600_000))) throw new HttpError(429, "Ya has contactado con este estudio hoy");
  if (input.jobId && !(await one("SELECT 1 FROM jobs WHERE id = ? AND user_id = ?", input.jobId, input.userId))) throw new HttpError(400, "Esa prueba no es tuya");
  const id = newId();
  await run("INSERT INTO leads (id, user_id, org_id, job_id, kind, message, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, input.userId, input.orgId, input.jobId ?? null, input.kind, message || null, now(), now());
  return id;
}
