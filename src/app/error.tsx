"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap grid max-w-2xl gap-6 py-24" role="alert">
      <h1 className="text-[clamp(2rem,5vw,3.4rem)]">Algo ha fallado</h1>
      <p className="text-bone/80">No ha sido culpa tuya. Prueba otra vez; si sigue pasando, vuelve en unos minutos.</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={reset}>Volver a intentarlo</button>
        <Link href="/" className="btn btn-ghost">Ir al inicio</Link>
      </div>
      {error.digest && <p className="hint">Referencia del error: {error.digest}</p>}
    </div>
  );
}
