import { AdminOrgs } from "@/components/admin/AdminOrgs";
import { listOrgs } from "@/lib/admin";
import { AdminRequests } from "@/components/admin/AdminRequests";
import { listRequests } from "@/lib/studio-requests";

export const dynamic = "force-dynamic";

export default async function Estudios() {
  const [orgs, requests] = await Promise.all([listOrgs(), listRequests("pending")]);
  return (
    <div className="grid gap-8">
      <h1 className="text-[clamp(2rem,4vw,3rem)]">Estudios <span className="text-mute">({orgs.length})</span></h1>
      <AdminRequests requests={requests} />
      <AdminOrgs orgs={orgs} />
    </div>
  );
}
