# Plan para que la IA salga realista y el flujo funcione

## Cómo funciona hoy el flujo (ya programado)
1. La persona sube **la foto de su piel** y marca dónde va el tatuaje (máscara, posición, tamaño).
2. Elige **qué tatuaje quiere**: describirlo con texto, subir una **foto de referencia**, **las dos cosas a la vez** (mezcla) o elegir uno del **catálogo flash** de un estudio.
3. Paso A, `createDesign`: la IA crea el diseño solo, sobre fondo blanco (con o sin referencia).
4. Paso B, `applyToSkin`: la IA edita la foto del brazo y pinta el diseño dentro de la máscara (hasta 3 variantes; gratis 1 con marca de agua).
5. Se guarda el resultado, se cobra el crédito, y la foto original se borra a las 24 h.

Prompts en `src/prompts/v1.ts`, proveedor en `src/lib/providers/openai.ts`.

## Prioridad: calidad y realismo por encima del coste
Decisión del dueño: lo más importante es que parezca real. Consecuencias:
- **Calidad `high` por defecto** en todas las pruebas de pago (no solo en HD). El coste por imagen sube, se asume y se ajustan los precios de los créditos.
- **Recortar y editar en alta resolución**: en vez de mandar la foto entera, recortar la zona alrededor de la máscara, editarla a máxima resolución y pegarla de vuelta con un borde suave. Más detalle en la piel y en la tinta.
- **Generar varias y elegir**: crear 3-4 candidatos y mostrar los mejores; después se puede añadir un filtro automático que descarte los deformados.
- **Pruebas ciegas**: comparar versiones del prompt sin saber cuál es cuál, para no autoengañarse.
- **Foto de entrada guiada**: la app pide luz natural, la zona entera y sin ropa. La mala foto es la causa nº 1 de un mal resultado.
- **Referencia de calidad**: para retratos o detalle fino, aconsejar subir la referencia grande y nítida (las pequeñas dan resultados borrosos, como vimos con el montaje).
- **Precio**: si el coste por imagen en `high` es alto, se sube el precio de los packs antes que bajar la calidad.

## Lo que tienes que hacer tú
1. Crear la clave en platform.openai.com, con **límite de gasto de 5-10 €**.
2. Ponerla como variable de entorno del proyecto (`OPENAI_API_KEY`), nunca pegada en el chat ni en el código.
3. Tener 6-8 fotos reales para probar: antebrazo, brazo, mano, pierna; piel clara y oscura; luz buena y mala; con vello.
4. Tener 6-8 diseños de prueba: animal, geométrico, letras, floral, blackwork, color, uno con referencia y uno mezclando referencia y texto.
5. Decidir con cuáles te quedas como ejemplos de marketing (que sean diseños con derechos).

## Lo que haré yo cuando haya clave
### Fase 1: verificar que funciona (1 hora, ~1-2 €)
- Comprobar en la documentación actual de OpenAI el nombre del modelo, los parámetros y los precios (hoy hay un modelo puesto por defecto sin verificar).
- Ejecutar `npm run probar:openai` con tu foto del brazo.
- Medir: tiempo por imagen, coste real por imagen, fallos.

### Fase 2: mejorar el realismo (lo que más cuenta)
- **Prompt de aplicación**: probar 3-4 versiones (piel, vello, luz, sombra, "tinta curada", sin cambiar nada fuera de la máscara). Subir `PROMPT_VERSION` por cada una y comparar.
- **Calidad**: comparar `medium` frente a `high` (el coste sube; usar `high` solo en HD de pago).
- **Máscara**: ajustar el tamaño y el borde para que no deforme el brazo ni aparezcan cortes.
- **Referencia**: cuando se sube una foto de otro tatuaje, extraer solo el motivo, nunca copiar a un artista.
- **Mezcla texto + referencia**: probar que el texto modifique la referencia (por ejemplo "este león pero con luna").
- **Retratos de personas reales**: la IA puede negarse o cambiar la cara; la app debe avisar con un mensaje claro y devolver el crédito.

### Fase 3: robustez
- Reintentos y devolución automática del crédito si falla (ya está), más un **tope diario de gasto en IA** (te lo propuse y no me respondiste; recomendado antes de lanzar).
- Medir qué porcentaje de resultados son "buenos" con las 8 fotos x 8 diseños. Objetivo antes de abrir al público: **al menos 7 de cada 10** presentables.
- Mostrar siempre "Simulación orientativa".

### Fase 4: contenido real
- Regenerar vídeos y carruseles con los mejores resultados reales.

## Cómo se evalúa si está bien
Una tabla simple: foto x diseño, nota de 1 a 5 en realismo, respeto de la piel, tamaño correcto y ausencia de deformaciones. Si la media es menor de 3,5, no se abre al público; se sigue ajustando el prompt.

## Riesgos
- El modelo puede cambiar de nombre o precio: se verifica el día de la prueba.
- Rechazos por moderación en ciertos motivos: mensaje claro y reembolso del crédito.
- Coste por imagen mayor del previsto: tope diario y alertas antes de abrir.
