import { Suspense } from "react";
import { Wizard } from "@/components/Wizard";

export const metadata = { title: "Prueba tu tatuaje" };

export default function Crear() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
