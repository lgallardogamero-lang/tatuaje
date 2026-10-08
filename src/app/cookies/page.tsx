import { Legal } from "@/components/Legal";

export const metadata = { title: "Cookies" };

export default function Page() {
  return (
    <Legal title="Cookies" updated="octubre de 2026">
      <p>Calco solo usa cookies técnicas, necesarias para que el servicio funcione. No usamos cookies de publicidad ni de analítica.</p>
      <ul>
        <li><strong>sid</strong> (sesión): te mantiene con la sesión iniciada. Dura 30 días o hasta que cierres sesión.</li>
        <li><strong>did</strong> (dispositivo): ayuda a evitar que se abuse de las pruebas gratuitas. Dura hasta 5 años.</li>
        <li><strong>g_state</strong>: solo si entras con Google, protege el inicio de sesión. Dura 10 minutos.</li>
      </ul>
      <ul>
        <li><strong>calco_consent</strong>: recuerda tu elección sobre cookies. Dura 12 meses, después te volvemos a preguntar.</li>
      </ul>
      <p>Puedes cambiar tu elección en cualquier momento desde «Gestionar cookies», en el pie de página. Si más adelante añadimos analítica o publicidad, solo se activarán si las aceptas. [Revisar con un abogado si basta con este aviso para cookies técnicas.]</p>
    </Legal>
  );
}
