import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { userDetail } from "@/lib/admin";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  free_grant: "Pruebas gratis de bienvenida",
  purchase: "Compra de créditos",
  generation: "Generación de tatuaje",
  refund: "Devolución",
  admin_grant: "Créditos regalados por un administrador",
  admin_revoke: "Créditos retirados por un administrador",
  asset_purchase: "Descarga HD o stencil",
};

export default async function UsuarioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, me] = await Promise.all([userDetail(id), getUser()]);
  if (!d) notFound();
  const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
  const eur = (c: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(c / 100);
  return (
    <div className="grid gap-10">
      <div>
        <Link href="/admin/usuarios" className="link text-sm">Volver a usuarios</Link>
        <h1 className="mt-2 break-all text-[clamp(1.8rem,3.5vw,2.6rem)]">{d.user.email}</h1>
        <p className="mt-2 text-bone/75">Alta {fmt.format(d.user.created_at)} · {d.user.role === "admin" ? "Administrador" : "Usuario"}{d.user.banned_at ? " · Bloqueado" : ""}</p>
      </div>
      <section className="panel grid gap-1 p-6"><p className="text-bone/75">Créditos</p><p className="display text-5xl text-stencil">{d.credits}</p></section>
      <AdminUserActions userId={d.user.id} isSelf={me?.id === d.user.id} role={d.user.role as "user" | "admin"} banned={Boolean(d.user.banned_at)} />
      <section className="grid gap-3">
        <h2 className="text-2xl">Compras</h2>
        {d.purchases.length === 0 ? <p className="text-bone/75">Sin compras.</p> : (
          <ul className="divide-y divide-line border-y border-line">
            {d.purchases.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 py-2.5"><span>{p.product}<span className="hint block">{fmt.format(p.created_at)} · {p.status}</span></span><span className="tabular-nums">{eur(p.amount_cents)}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-2xl">Movimientos de créditos</h2>
        <ul className="divide-y divide-line border-y border-line">
          {d.ledger.map((l) => (
            <li key={l.id} className="flex justify-between gap-4 py-2.5"><span>{REASON[l.reason] ?? l.reason}<span className="hint block">{fmt.format(l.created_at)}</span></span><span className={`tabular-nums font-semibold ${l.delta > 0 ? "text-ok" : ""}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
