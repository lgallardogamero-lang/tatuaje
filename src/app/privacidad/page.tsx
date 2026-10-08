import { Legal } from "@/components/Legal";

export const metadata = { title: "Aviso de privacidad" };

export default function Page() {
  return (
    <Legal title="Aviso de privacidad" updated="octubre de 2026">
      <p>Calco te deja ver cómo te quedaría un tatuaje en tu piel. Para eso tratamos tus fotos, que son datos personales. Aquí te explicamos qué hacemos con ellas, con lenguaje claro.</p>
      <h2>Quién es el responsable</h2>
      <p>[Nombre o razón social], NIF [pendiente], domicilio [pendiente], correo de contacto [pendiente].</p>
      <h2>Qué datos tratamos y para qué</h2>
      <ul>
        <li><strong>Email:</strong> para crear tu cuenta y enviarte el enlace de acceso. Base legal: ejecución del servicio que pides.</li>
        <li><strong>Fotos que subes, referencias y máscaras:</strong> solo para generar tu simulación. Base legal: tu consentimiento, que das al registrarte y puedes retirar borrándolas.</li>
        <li><strong>Texto del diseño y opciones:</strong> para generar el tatuaje y para moderar contenido no permitido.</li>
        <li><strong>Pagos:</strong> los procesa Stripe. No vemos ni guardamos los datos de tu tarjeta; guardamos el importe, la fecha y el producto comprado. Conservamos estos datos el tiempo que exige la normativa fiscal y contable.</li>
        <li><strong>Datos técnicos (IP, dispositivo):</strong> para evitar abusos y fraude con las pruebas gratuitas. Se guardan de forma desidentificada.</li>
      </ul>
      <h2>Cuánto tiempo guardamos tus fotos</h2>
      <ul>
        <li>Las fotos que subes (foto, máscara y referencia) se borran automáticamente a las <strong>24 horas</strong>.</li>
        <li>Puedes borrarlas antes con el botón «Borrar mis fotos» de tu cuenta.</li>
        <li>Si compras el resultado en alta resolución o el stencil, conservamos ese resultado <strong>30 días</strong> para que puedas descargarlo.</li>
      </ul>
      <h2>Con quién compartimos los datos</h2>
      <ul>
        <li><strong>Proveedor de inteligencia artificial</strong> [pendiente de elegir]: recibe tu foto, tu diseño y tu máscara para generar el resultado. [Indicar país del proveedor y garantías de la transferencia internacional, por ejemplo cláusulas contractuales tipo.] No usamos tus fotos para entrenar modelos y exigiremos lo mismo al proveedor.</li>
        <li><strong>Cloudflare:</strong> alojamiento y almacenamiento.</li>
        <li><strong>Stripe:</strong> pagos y facturas.</li>
        <li><strong>Proveedor de correo</strong> [pendiente]: envío del enlace de acceso.</li>
        <li><strong>Estudios de tatuaje:</strong> solo si pulsas «Contactar» o «Reservar» en un estudio, y únicamente los datos que decidas enviarle.</li>
      </ul>
      <h2>Qué no hacemos</h2>
      <ul>
        <li>No publicamos tus fotos ni las usamos en publicidad.</li>
        <li>No vendemos tus datos.</li>
        <li>No admitimos desnudos, imágenes de menores ni contenido violento o de odio. Revisamos automáticamente lo que se sube.</li>
      </ul>
      <h2>Edad</h2>
      <p>Calco es solo para mayores de 18 años. Al registrarte confirmas que lo eres.</p>
      <h2>Tus derechos</h2>
      <p>Puedes acceder a tus datos, rectificarlos, borrarlos, limitar su uso, oponerte, pedir su portabilidad y retirar tu consentimiento escribiendo a [correo pendiente]. Desde tu cuenta puedes borrar tus fotos y eliminar tu cuenta. Si crees que no tratamos tus datos bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      <h2>Seguridad</h2>
      <p>Las fotos solo se pueden descargar desde tu sesión, viajan cifradas y se guardan con acceso restringido.</p>
    </Legal>
  );
}
