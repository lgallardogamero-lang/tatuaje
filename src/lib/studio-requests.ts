import { all, one, run, now } from "./db";
import { newId } from "./ids";
import { HttpError, type User } from "./auth";
import { getEnv } from "./env";
import { sendMail } from "./email";
import { moderateTextLocal } from "./moderation";
import { hit } from "./ratelimit";
import { createOrg, logAdmin } from "./admin";
import { STUDIO_PLANS, type StudioPlan } from "./config";
import { getMembership } from "./studio";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface StudioRequest {
  id: string;
  user_id: string;
  email: string;
  name: string;
  city: string;
  contact_email: string;
  instagram: string | null;
  plan_wanted: StudioPlan;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: number;
}

export interface RequestInput {
  name: string;
  city: string;
  contactEmail: string;
  instagram?: string;
  plan: StudioPlan;
  message?: string;
}

/** Aviso a los administradores (los de ADMIN_EMAILS). Nunca hace fallar la operación principal. */
async function notifyAdmins(subject: string, text: string) {
  const admins = (getEnv().ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  for (const to of admins) await sendMail({ to, subject, text }).catch((e) => console.error("Aviso a administrador falló", e));
}

export async function createRequest(user: Pick<User, "id" | "email">, input: RequestInput): Promise<string> {
  const name = input.name.trim();
  const city = input.city.trim();
  const contact = input.contactEmail.trim();
  const ig = (input.instagram ?? "").trim().replace(/^@/, "");
  const message = (input.message ?? "").trim().slice(0, 600);
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Escribe el nombre del estudio");
  if (city.length < 2 || city.length > 60) throw new HttpError(400, "Indica la ciudad");
  if (!EMAIL_RE.test(contact) || contact.length > 254) throw new HttpError(400, "El email de contacto no es válido");
  if (ig && !/^[a-zA-Z0-9._]{1,30}$/.test(ig)) throw new HttpError(400, "El usuario de Instagram no es válido");
  if (!(input.plan in STUDIO_PLANS)) throw new HttpError(400, "Elige un plan");
  for (const t of [name, message]) {
    const m = moderateTextLocal(t);
    if (!m.ok) throw new HttpError(422, `No podemos aceptar ese texto: ${m.reason}`);
  }
  if (await getMembership(user.id)) throw new HttpError(400, "Ya perteneces a un estudio");
  if (await one("SELECT 1 FROM studio_requests WHERE user_id = ? AND status = 'pending'", user.id)) throw new HttpError(400, "Ya tienes una solicitud en revisión. Te avisaremos por email");
  if (!(await hit(`sreq:${user.id}`, 3, 24 * 3600_000))) throw new HttpError(429, "Has enviado varias solicitudes hoy. Prueba mañana");
  const id = newId();
  await run(
    "INSERT INTO studio_requests (id, user_id, name, city, contact_email, instagram, plan_wanted, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, user.id, name, city, contact, ig || null, input.plan, message || null, now(),
  );
  await notifyAdmins("Nueva solicitud de estudio", `${name} (${city}) quiere el plan ${STUDIO_PLANS[input.plan].label}.\nContacto: ${contact}\nRevísala en ${getEnv().APP_URL}/admin/estudios`);
  return id;
}

export async function myLatestRequest(userId: string): Promise<Pick<StudioRequest, "id" | "name" | "status" | "created_at"> | null> {
  return one("SELECT id, name, status, created_at FROM studio_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userId);
}

export const listRequests = (status: StudioRequest["status"] = "pending") =>
  all<StudioRequest>(
    `SELECT r.id, r.user_id, u.email, r.name, r.city, r.contact_email, r.instagram, r.plan_wanted, r.message, r.status, r.created_at
     FROM studio_requests r JOIN users u ON u.id = r.user_id WHERE r.status = ? ORDER BY r.created_at`,
    status,
  );

export const pendingCount = async () => (await one<{ n: number }>("SELECT COUNT(*) AS n FROM studio_requests WHERE status = 'pending'"))?.n ?? 0;

/** Aprobar crea el estudio con quien lo pidió como responsable, y le avisa por email. */
export async function approveRequest(admin: User, id: string, plan: StudioPlan | "none"): Promise<string> {
  const r = await one<StudioRequest>(
    "SELECT r.id, r.user_id, u.email, r.name, r.city, r.contact_email, r.instagram, r.plan_wanted, r.message, r.status, r.created_at FROM studio_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?",
    id,
  );
  if (!r) throw new HttpError(404, "Solicitud no encontrada");
  if (r.status !== "pending") throw new HttpError(400, "Esta solicitud ya está resuelta");
  // Se marca primero: si dos administradores aprueban a la vez, solo uno crea el estudio.
  const claimed = await run("UPDATE studio_requests SET status = 'approved', decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'", admin.id, now(), id);
  if (claimed !== 1) throw new HttpError(400, "Esta solicitud ya está resuelta");
  try {
    const orgId = await createOrg(admin, { name: r.name, city: r.city, ownerEmail: r.email, plan });
    await run("UPDATE organizations SET contact_email = ?, instagram = ? WHERE id = ?", r.contact_email, r.instagram, orgId);
    await logAdmin(admin, "studio_request.approve", r.name, { plan });
    await sendMail({ to: r.email, subject: "Tu estudio ya está en Calco", text: `Hemos dado de alta ${r.name}. Entra en ${getEnv().APP_URL}/estudio para subir tu catálogo y probar diseños con tus clientes.` }).catch(() => {});
    return orgId;
  } catch (e) {
    await run("UPDATE studio_requests SET status = 'pending', decided_by = NULL, decided_at = NULL WHERE id = ?", id); // si falla, vuelve a la cola
    throw e;
  }
}

export async function rejectRequest(admin: User, id: string, reason?: string): Promise<void> {
  const r = await one<{ name: string; email: string; status: string }>("SELECT r.name, u.email, r.status FROM studio_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?", id);
  if (!r) throw new HttpError(404, "Solicitud no encontrada");
  const changed = await run("UPDATE studio_requests SET status = 'rejected', decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'", admin.id, now(), id);
  if (changed !== 1) throw new HttpError(400, "Esta solicitud ya está resuelta");
  await logAdmin(admin, "studio_request.reject", r.name, reason ? { reason } : undefined);
  await sendMail({ to: r.email, subject: "Sobre tu solicitud en Calco", text: `Por ahora no hemos podido dar de alta ${r.name}.${reason ? ` Motivo: ${reason}` : ""} Puedes responder a este correo si quieres más información.` }).catch(() => {});
}
