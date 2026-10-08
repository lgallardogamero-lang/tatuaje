import { AdminOrgs } from "@/components/admin/AdminOrgs";
import { listOrgs } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Estudios() {
  const orgs = await listOrgs();
  return (
    <div className="grid gap-8">
      <h1 className="text-[clamp(2rem,4vw,3rem)]">Estudios <span className="text-mute">({orgs.length})</span></h1>
      <AdminOrgs orgs={orgs} />
    </div>
  );
}
