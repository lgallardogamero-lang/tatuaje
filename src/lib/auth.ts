import { cookies, headers } from "next/headers";
import { all, one, run, now } from "./db";
import { getEnv, isSecureUrl } from "./env";
import { newId, randomToken, sha256 } from "./ids";
import { FREE_CREDITS, LIMITS } from "./config";
import { hit } from "./ratelimit";
import { sendMail } from "./email";

export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
}

const SESSION_DAYS = 30;
const LINK_MINUTES = 15;
export const SESSION_COOKIE = "sid";
export const DEVICE_COOKIE = "did";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => e.length <= 254 && EMAIL_RE.test(e);

/** Protección CSRF para peticiones que cambian estado: el Origin debe coincidir con la app. */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // peticiones del propio navegador sin Origin (GET/HEAD) no llegan aquí
  const allowed = new URL(getEnv().APP_URL).origin;
  const host = h.get("host");
  const originHost = new URL(origin).host;
  if (origin !== allowed && originHost !== host) throw new HttpError(403, "Origen no permitido");
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function ipHash(): Promise<string> {
  return (await sha256(`${getEnv().SESSION_SECRET}:${await clientIp()}`)).slice(0, 32);
}

export async function requestMagicLink(rawEmail: string): Promise<{ devLink?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) throw new HttpError(400, "Escribe un email válido");
  const ip = await ipHash();
  const okEmail = await hit(`ml:email:${email}`, LIMITS.magicLinkPerEmailPerHour, 3600_000);
  const okIp = await hit(`ml:ip:${ip}`, LIMITS.magicLinkPerIpPerHour, 3600_000);
  if (!okEmail || !okIp) throw new HttpError(429, "Demasiados intentos. Espera un rato y vuelve a probar");

  const token = randomToken();
  await run(
    "INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)",
    await sha256(token),
    email,
    now() + LINK_MINUTES * 60_000,
    now(),
  );
  const env = getEnv();
  const link = `${env.APP_URL}/entrar/verificar?token=${token}`;
  await sendMail({
    to: email,
    subject: "Tu enlace para entrar",
    text: `Pulsa para entrar: ${link}\n\nCaduca en ${LINK_MINUTES} minutos. Si no lo has pedido tú, ignora este correo.`,
  });
  return env.EMAIL_PROVIDER === "resend" ? {} : { devLink: link };
}

/** Consume el enlace (una sola vez) y devuelve el usuario, creándolo si es nuevo. */
export async function consumeMagicLink(token: string): Promise<User> {
  const hash = await sha256(token);
  const changed = await run(
    "UPDATE magic_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    now(),
    hash,
    now(),
  );
  if (changed !== 1) throw new HttpError(400, "El enlace ha caducado o ya se usó. Pide uno nuevo");
  const row = await one<{ email: string }>("SELECT email FROM magic_links WHERE token_hash = ?", hash);
  if (!row) throw new HttpError(400, "Enlace no válido");
  return upsertUser(row.email);
}

export async function upsertUser(rawEmail: string): Promise<User> {
  const email = normalizeEmail(rawEmail);
  const env = getEnv();
  const admins = (env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  let user = await one<User>("SELECT id, email, role FROM users WHERE email = ? AND deleted_at IS NULL", email);
  if (!user) {
    const id = newId();
    const role = admins.includes(email) ? "admin" : "user";
    await run(
      "INSERT INTO users (id, email, role, adult_confirmed_at, privacy_accepted_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      email,
      role,
      now(),
      now(),
      now(),
    );
    user = { id, email, role };
    await grantFreeCredits(id);
  } else if (admins.includes(email) && user.role !== "admin") {
    await run("UPDATE users SET role = 'admin' WHERE id = ?", user.id);
    user.role = "admin";
  }
  return user;
}

/** Concede las pruebas gratuitas salvo que la IP o el dispositivo ya hayan agotado las suyas. */
async function grantFreeCredits(userId: string) {
  const jar = await cookies();
  const device = jar.get(DEVICE_COOKIE)?.value ?? randomToken(16);
  const ipOk = await hit(`grant:ip:${await ipHash()}`, LIMITS.signupPerIpPerMonth, 30 * 24 * 3600_000);
  // Un dispositivo (cookie) solo recibe las pruebas gratis una vez; la ventana enorme equivale a "para siempre".
  const deviceOk = await hit(`grant:dev:${device}`, 1, 3650 * 24 * 3600_000);
  jar.set(DEVICE_COOKIE, device, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureUrl(getEnv()),
    maxAge: 60 * 60 * 24 * 365 * 5,
    path: "/",
  });
  if (!ipOk || !deviceOk) return;
  await run(
    "INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at) VALUES (?, ?, ?, 'free_grant', ?, ?)",
    newId(),
    userId,
    FREE_CREDITS,
    userId,
    now(),
  );
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  await run(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    await sha256(token),
    userId,
    now() + SESSION_DAYS * 86400_000,
    now(),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureUrl(getEnv()),
    maxAge: SESSION_DAYS * 86400,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
  jar.delete(SESSION_COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<User>(
    `SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
    await sha256(token),
    now(),
  );
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Inicia sesión para continuar");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") throw new HttpError(403, "Sin permisos");
  return u;
}

export async function deleteAccount(userId: string): Promise<void> {
  await run("DELETE FROM sessions WHERE user_id = ?", userId);
  await run("UPDATE users SET deleted_at = ?, email = ? WHERE id = ?", now(), `borrado-${userId}@invalid`, userId);
}

export async function listSessionsCount(userId: string) {
  return (await all("SELECT 1 FROM sessions WHERE user_id = ?", userId)).length;
}
