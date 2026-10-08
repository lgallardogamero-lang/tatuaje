import { AdminChart } from "@/components/admin/AdminChart";
import { dashboard } from "@/lib/admin";
import { eur } from "@/lib/config";

export const dynamic = "force-dynamic";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid gap-1 bg-ink p-5">
      <p className="text-sm text-bone/75">{label}</p>
      <p className="display text-4xl">{value}</p>
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

export default async function Resumen() {
  const d = await dashboard();
  return (
    <div className="grid gap-10">
      <h1 className="text-[clamp(2rem,4vw,3rem)]">Resumen</h1>
      <div className="grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingresos totales" value={eur(d.revenue.totalCents)} note={`${eur(d.revenue.netTotalCents)} sin IVA`} />
        <Stat label="Coste de IA estimado" value={eur(d.ai.costCents)} note={`${d.ai.images} imágenes a ${(d.ai.unitCostCents / 100).toFixed(3)} €`} />
        <Stat label="Margen" value={eur(d.marginCents)} note="Ingresos sin IVA menos coste de IA. No descuenta comisiones de Stripe" />
        <Stat label="Créditos en circulación" value={String(d.creditsOutstanding)} note="Saldo total de todos los usuarios" />
        <Stat label="Usuarios" value={String(d.users.total)} note={`${d.users.last7} nuevos en 7 días · ${d.users.last30} en 30 días`} />
        <Stat label="Ingresos 30 días" value={eur(d.revenue.last30Cents)} note={`Hoy: ${eur(d.revenue.todayCents)}`} />
        <Stat label="Generaciones" value={String(d.ai.jobsDone)} note={`${d.ai.jobsFailed} fallidas`} />
        <Stat label="Estudios" value={`${d.studios.active}/${d.studios.total}`} note="Activos / total" />
      </div>
      <AdminChart series={d.series} />
      <section aria-labelledby="prod" className="grid gap-3">
        <h2 id="prod" className="text-2xl">Ingresos por producto</h2>
        {d.revenue.byProduct.length === 0 ? (
          <p className="text-bone/75">Todavía no hay ventas.</p>
        ) : (
          <table className="w-full max-w-xl text-left">
            <thead className="text-mute"><tr><th className="py-1 font-semibold">Producto</th><th className="font-semibold">Ventas</th><th className="text-right font-semibold">Importe</th></tr></thead>
            <tbody>
              {d.revenue.byProduct.map((p) => (
                <tr key={p.product} className="border-t border-line"><td className="py-2">{p.product}</td><td>{p.count}</td><td className="text-right">{eur(p.cents)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="hint max-w-[70ch]">El coste de IA es una estimación (imágenes generadas × coste unitario que defines en Precios). Con el proveedor simulado no hay coste real. Cuando uses un proveedor de pago, contrasta esta cifra con su factura.</p>
    </div>
  );
}
