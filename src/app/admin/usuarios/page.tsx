import Link from "next/link";
import { listUsers } from "@/lib/admin";
import { dateOnly } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE = 25;

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const { rows, total } = await listUsers(q, page, PAGE);
  const fmt = dateOnly;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const eur = (c: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(c / 100);
  return (
    <div className="grid gap-6">
      <h1 className="text-[clamp(2rem,4vw,3rem)]">Usuarios <span className="text-mute">({total})</span></h1>
      <form className="flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar por email</label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Buscar por email" />
        <button className="btn btn-ghost">Buscar</button>
      </form>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
        <table className="w-full min-w-[46rem] text-left">
          <thead className="text-mute">
            <tr><th className="py-2 pr-4 font-semibold">Email</th><th className="pr-4 font-semibold">Alta</th><th className="pr-4 font-semibold">Créditos</th><th className="pr-4 font-semibold">Pruebas</th><th className="pr-4 font-semibold">Gastado</th><th className="font-semibold">Estado</th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="py-2.5 pr-4"><Link className="link" href={`/admin/usuarios/${u.id}`}>{u.email}</Link></td>
                <td className="pr-4">{fmt.format(u.created_at)}</td>
                <td className="pr-4 tabular-nums">{u.credits}</td>
                <td className="pr-4 tabular-nums">{u.jobs}</td>
                <td className="pr-4 tabular-nums">{eur(u.spent_cents)}</td>
                <td>{u.banned_at ? <span className="text-danger">Bloqueado</span> : u.role === "admin" ? <span className="text-stencil">Admin</span> : "Activo"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-bone/75">Ningún usuario coincide.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-3" aria-label="Paginación">
          {page > 0 && <Link className="btn btn-ghost btn-sm" href={`?q=${encodeURIComponent(q)}&p=${page - 1}`}>Anterior</Link>}
          <span className="hint">Página {page + 1} de {pages}</span>
          {page + 1 < pages && <Link className="btn btn-ghost btn-sm" href={`?q=${encodeURIComponent(q)}&p=${page + 1}`}>Siguiente</Link>}
        </nav>
      )}
    </div>
  );
}
