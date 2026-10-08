/** Formato de fechas único para toda la web, en hora de Madrid, para que servidor y navegador coincidan al hidratar. */
const TZ = "Europe/Madrid";
export const dateTime = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
export const dateOnly = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: TZ });
