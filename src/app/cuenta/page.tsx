import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { balance, history } from "@/lib/credits";
import { AccountActions } from "@/components/AccountActions";

export const metadata = { title: "Tu cuenta" };

const REASON: Record<string, string> = {
  free_grant: "Pruebas gratis de bienvenida",
  purchase: "Compra de créditos",
  generation: "Generación de tatuaje",
  refund: "Devolución",
  admin_grant: "Créditos regalados",
  admin_revoke: "Créditos retirados",
  asset_purchase: "Descarga HD o stencil",
};

export default async function Cuenta() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const [credits, rows] = await Promise.all([balance(user.id), history(user.id)]);
  const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="wrap grid max-w-3xl gap-10 py-14">
      <div>
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)]">Tu cuenta</h1>
        <p className="mt-2 text-bone/75">{user.email}</p>
      </div>
      <section aria-labelledby="saldo" className="panel grid gap-2 p-7">
        <h2 id="saldo" className="text-xl text-bone/75">Créditos disponibles</h2>
        <p className="display text-6xl text-stencil">{credits}</p>
      </section>
      <section aria-labelledby="mov" className="grid gap-4">
        <h2 id="mov" className="text-2xl">Movimientos</h2>
        {rows.length === 0 ? (
          <p className="text-bone/75">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                <span>
                  {REASON[r.reason] ?? r.reason}
                  <span className="hint block">{fmt.format(r.created_at)}</span>
                </span>
                <span className={`tabular-nums font-semibold ${r.delta > 0 ? "text-ok" : "text-bone/80"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AccountActions />
    </div>
  );
}
