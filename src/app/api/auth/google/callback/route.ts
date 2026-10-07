import { cookies } from "next/headers";
import { createSession, upsertUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/ids";

/** SIN PROBAR contra Google real: requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET. */
export async function GET(req: Request) {
  const env = getEnv();
  const fail = () => Response.redirect(`${env.APP_URL}/entrar?error=google`, 302);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("g_state")?.value;
  jar.delete("g_state");
  if (!code || !state || !saved || !safeEqual(state, saved) || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.APP_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail();
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return fail();
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!info.ok) return fail();
  const profile = (await info.json()) as { email?: string; email_verified?: boolean };
  if (!profile.email || !profile.email_verified) return fail();
  const user = await upsertUser(profile.email);
  await createSession(user.id);
  return Response.redirect(`${env.APP_URL}/crear`, 302);
}
