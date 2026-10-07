import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/crear");
  const sp = await searchParams;
  return (
    <div className="wrap grid max-w-xl gap-6 py-16">
      {sp.error === "google" && <p className="notice error" role="alert">No hemos podido entrar con Google. Prueba con tu email.</p>}
      <AuthForm showGoogle={Boolean(getEnv().GOOGLE_CLIENT_ID)} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY} />
    </div>
  );
}
