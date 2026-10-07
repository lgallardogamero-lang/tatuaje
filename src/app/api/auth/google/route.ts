import { cookies } from "next/headers";
import { getEnv, isSecureUrl } from "@/lib/env";
import { randomToken } from "@/lib/ids";

export async function GET() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) return Response.redirect(`${env.APP_URL}/entrar?error=google`, 302);
  const state = randomToken(16);
  (await cookies()).set("g_state", state, { httpOnly: true, sameSite: "lax", secure: isSecureUrl(env), maxAge: 600, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return Response.redirect(url.toString(), 302);
}
