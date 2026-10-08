import { Legal } from "@/components/Legal";

export const metadata = { title: "Condiciones de uso" };

export default function Page() {
  return (
    <Legal title="Condiciones de uso" updated="octubre de 2026">
      <h2>Qué es Calco</h2>
      <p>Calco genera, con inteligencia artificial, una simulación de cómo quedaría un tatuaje sobre la foto que subes. Es una herramienta para decidir; <strong>no es una garantía del resultado real</strong>, que depende del tatuador, de tu piel y de la cicatrización.</p>
      <h2>Quién puede usarlo</h2>
      <p>Personas mayores de 18 años con una cuenta. Eres responsable de las fotos que subes: deben ser tuyas o tener permiso de la persona que aparece.</p>
      <h2>Contenido no permitido</h2>
      <ul>
        <li>Desnudos o contenido sexual explícito.</li>
        <li>Imágenes de menores.</li>
        <li>Contenido violento, de odio o que incite a la discriminación.</li>
        <li>Fotos de otras personas sin su permiso.</li>
      </ul>
      <p>Podemos rechazar una petición o suspender una cuenta que incumpla estas condiciones.</p>
      <h2>Créditos y pagos</h2>
      <ul>
        <li>Al registrarte recibes 3 pruebas gratis. Cada prueba gratuita genera una variante con marca de agua.</li>
        <li>Los créditos se compran en paquetes de pago único. Cada generación consume 1 crédito; regenerar consume otro.</li>
        <li>Si una generación falla por un error nuestro, se te devuelve el crédito automáticamente.</li>
        <li>La descarga en alta resolución sin marca de agua y el stencil se pagan aparte o con créditos.</li>
        <li>Los precios incluyen IVA. Recibirás factura descargable.</li>
        <li>Derecho de desistimiento: el contenido digital que empieza a prestarse tras tu petición expresa no admite desistimiento una vez generado. [Pendiente: añadir casilla de consentimiento expreso en el pago y revisión legal.]</li>
      </ul>
      <h2>Propiedad de los diseños</h2>
      <p>Los diseños generados son para tu uso personal y para llevarlos a tu tatuador. Si subes una referencia, confirmas que puedes usarla. No garantizamos que un diseño generado sea original o esté libre de derechos de terceros.</p>
      <h2>Responsabilidad</h2>
      <p>Calco se ofrece «tal cual». No somos responsables de decisiones sobre tatuajes tomadas a partir de la simulación. [Revisar limitaciones de responsabilidad con un abogado.]</p>
      <h2>Contacto</h2>
      <p>[Correo pendiente]</p>
    </Legal>
  );
}
