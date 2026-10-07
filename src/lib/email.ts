import { getEnv } from "./env";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Envía un correo. `console` imprime el contenido (solo desarrollo); `resend` usa la API de Resend. */
export async function sendMail(mail: Mail): Promise<void> {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Falta RESEND_API_KEY o EMAIL_FROM");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
    return;
  }
  console.log(`\n[correo simulado] Para: ${mail.to}\nAsunto: ${mail.subject}\n${mail.text}\n`);
}

export const isConsoleMail = () => getEnv().EMAIL_PROVIDER !== "resend";
