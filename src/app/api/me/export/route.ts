import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { all, one } from "@/lib/db";

/** Portabilidad (RGPD art. 20): todos los datos de la cuenta en JSON. Las fotos no se incluyen porque se borran a las 24 h. */
export const GET = handle(async () => {
  const user = await requireUser();
  const data = {
    exportadoEl: new Date().toISOString(),
    nota: "Las fotos que subes se borran automáticamente a las 24 horas, por eso no figuran aquí.",
    cuenta: await one("SELECT id, email, role AS rol, adult_confirmed_at AS mayorDeEdadConfirmadoEn, privacy_accepted_at AS privacidadAceptadaEn, created_at AS creadaEn FROM users WHERE id = ?", user.id),
    movimientosDeCreditos: await all("SELECT delta, reason AS motivo, created_at AS fecha FROM credit_ledger WHERE user_id = ? ORDER BY created_at", user.id),
    compras: await all("SELECT product AS producto, amount_cents AS importeCentimos, currency AS moneda, status AS estado, created_at AS fecha FROM purchases WHERE user_id = ? ORDER BY created_at", user.id),
    pruebas: await all("SELECT id, status AS estado, options AS opciones, created_at AS fecha FROM jobs WHERE user_id = ? ORDER BY created_at", user.id),
    descargasCompradas: await all("SELECT job_id AS prueba, kind AS tipo, created_at AS fecha FROM entitlements WHERE user_id = ?", user.id),
    contactosConEstudios: await all("SELECT org_id AS estudio, kind AS tipo, message AS mensaje, created_at AS fecha FROM leads WHERE user_id = ?", user.id),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="mis-datos-calco.json"', "Cache-Control": "no-store" },
  });
});
