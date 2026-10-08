/** Preferencias de cookies. Hoy solo hay cookies necesarias; si se añade analítica, cargarla SOLO si hasConsent("analytics"). */
export const CONSENT_COOKIE = "calco_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_MONTHS = 12;

export interface Consent {
  v: number;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!m) return null;
  try {
    const c = JSON.parse(decodeURIComponent(m.slice(CONSENT_COOKIE.length + 1))) as Consent;
    if (c.v !== CONSENT_VERSION || Date.now() - c.ts > CONSENT_MONTHS * 30 * 86400_000) return null; // caduca y se vuelve a preguntar
    return c;
  } catch {
    return null;
  }
}

export function saveConsent(c: Pick<Consent, "analytics" | "marketing">): Consent {
  const full: Consent = { v: CONSENT_VERSION, ...c, ts: Date.now() };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(full))}; Max-Age=${CONSENT_MONTHS * 30 * 86400}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("calco:consent", { detail: full }));
  return full;
}

export const hasConsent = (k: "analytics" | "marketing") => readConsent()?.[k] === true;
export const OPEN_COOKIES_EVENT = "calco:open-cookies";
