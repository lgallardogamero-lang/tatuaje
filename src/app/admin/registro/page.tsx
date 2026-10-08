import { recentLog } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Registro() {
  const rows = await recentLog(200);
  const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)]">Registro de administración</h1>
        <p className="measure mt-3 text-bone/75">Todas las acciones de administradores quedan aquí y no se pueden editar desde el panel.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-bone/75">Aún no hay acciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-mute"><tr><th className="py-2 pr-4 font-semibold">Cuándo</th><th className="pr-4 font-semibold">Quién</th><th className="pr-4 font-semibold">Acción</th><th className="pr-4 font-semibold">Sobre</th><th className="font-semibold">Detalle</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{fmt.format(r.created_at)}</td>
                  <td className="pr-4">{r.admin_email}</td>
                  <td className="pr-4">{r.action}</td>
                  <td className="pr-4 break-all">{r.target ?? "—"}</td>
                  <td className="break-all text-bone/75">{r.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
