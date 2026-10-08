import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Administración", robots: { index: false, follow: false } };

const LINKS = [
  ["/admin", "Resumen"],
  ["/admin/usuarios", "Usuarios"],
  ["/admin/estudios", "Estudios"],
  ["/admin/precios", "Precios"],
  ["/admin/registro", "Registro"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user || user.role !== "admin") notFound(); // no revela que existe el panel
  return (
    <div className="wrap py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-sm text-mute">Administración</p>
          <p className="text-bone/80">{user.email}</p>
        </div>
        <nav aria-label="Administración" className="flex flex-wrap gap-1">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="btn btn-quiet">{label}</Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
