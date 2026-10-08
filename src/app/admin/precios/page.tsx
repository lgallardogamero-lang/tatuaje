import { AdminPricingForm } from "@/components/admin/AdminPricingForm";
import { getPricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Precios() {
  const p = await getPricing();
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)]">Precios y parámetros</h1>
        <p className="measure mt-3 text-bone/75">Los cambios se aplican enseguida a la web y a los cobros nuevos. Los pagos ya iniciados se abonan con el precio con el que se crearon.</p>
      </div>
      <AdminPricingForm initial={p} />
    </div>
  );
}
