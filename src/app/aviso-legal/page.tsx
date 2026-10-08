import { Legal } from "@/components/Legal";

export const metadata = { title: "Aviso legal" };

export default function Page() {
  return (
    <Legal title="Aviso legal" updated="octubre de 2026">
      <h2>Datos del titular</h2>
      <p>En cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE):</p>
      <ul>
        <li>Titular: [nombre o razón social]</li>
        <li>NIF/CIF: [pendiente]</li>
        <li>Domicilio: [pendiente]</li>
        <li>Correo electrónico: [pendiente]</li>
        <li>Registro Mercantil (si aplica): [pendiente]</li>
      </ul>
      <h2>Objeto</h2>
      <p>Calco ofrece una herramienta de simulación de tatuajes con inteligencia artificial. El acceso y uso del sitio implica aceptar las <a className="link" href="/terminos">condiciones de uso</a>.</p>
      <h2>Propiedad intelectual</h2>
      <p>El diseño del sitio, su código, textos y marca pertenecen al titular. Las fotos que subes son tuyas; los diseños generados son para tu uso personal y para llevarlos a tu tatuador.</p>
      <h2>Responsabilidad</h2>
      <p>Las simulaciones son orientativas. El titular no responde de decisiones tomadas a partir de ellas ni de interrupciones del servicio ajenas a su control.</p>
      <h2>Legislación y jurisdicción</h2>
      <p>Se aplica la legislación española. Si eres consumidor, puedes acudir a los juzgados de tu domicilio y a la plataforma europea de resolución de litigios en línea: ec.europa.eu/consumers/odr.</p>
    </Legal>
  );
}
