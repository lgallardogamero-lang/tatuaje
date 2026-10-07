/**
 * Configuración de negocio. Todos los precios, cupos y límites viven aquí
 * (o se sobrescriben desde el panel de administración); nunca en el código de las pantallas.
 */
export const FREE_CREDITS = 3;
export const VARIANTS_PER_GENERATION = 3;
export const DATA_RETENTION_HOURS = 24;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2048;

export const CREDIT_PACKS = [
  { id: "pack10", credits: 10, priceCents: 499, label: "Para probar" },
  { id: "pack30", credits: 30, priceCents: 999, label: "El más elegido", highlight: true },
  { id: "pack75", credits: 75, priceCents: 1999, label: "Para varios diseños" },
] as const;

/** Productos sueltos por trabajo (se pagan con créditos o con dinero). */
export const ASSET_PRODUCTS = {
  hd: { credits: 2, priceCents: 199, label: "Descarga HD sin marca de agua" },
  stencil: { credits: 3, priceCents: 299, label: "Stencil para el tatuador" },
} as const;
export type AssetKind = keyof typeof ASSET_PRODUCTS;

export const STUDIO_PLANS = {
  basic: { label: "Básico", priceCents: 2900, quota: 100, features: ["Modo estudio"] },
  pro: { label: "Pro", priceCents: 5900, quota: 300, features: ["Modo estudio", "Tu logo y colores", "Widget para tu web"] },
  premium: {
    label: "Premium",
    priceCents: 9900,
    // Cupo reducido respecto al plan comercial (800): con el coste actual de IA, 800 pierde dinero. Ver docs/DISENO.md §6 bis.
    quota: 400,
    features: ["Modo estudio", "Tu logo y colores", "Widget para tu web", "Destacado en el directorio", "Catálogo de flash"],
  },
} as const;
export type StudioPlan = keyof typeof STUDIO_PLANS;

export const STYLES = [
  { id: "fine-line", label: "Línea fina" },
  { id: "realista", label: "Realista" },
  { id: "old-school", label: "Tradicional" },
  { id: "neotradicional", label: "Neotradicional" },
  { id: "blackwork", label: "Blackwork" },
  { id: "acuarela", label: "Acuarela" },
  { id: "japones", label: "Japonés" },
  { id: "geometrico", label: "Geométrico" },
  { id: "lettering", label: "Lettering" },
  { id: "minimalista", label: "Minimalista" },
] as const;
export type StyleId = (typeof STYLES)[number]["id"];

export const BODY_ZONES = ["brazo", "antebrazo", "mano", "pierna", "espalda", "cuello", "otro"] as const;

export const SIZES = [
  { id: "pequeno", label: "Pequeño (5 cm)" },
  { id: "mediano", label: "Mediano (10 cm)" },
  { id: "grande", label: "Grande (20 cm)" },
] as const;

export const LIMITS = {
  signupPerIpPerMonth: 3,
  magicLinkPerEmailPerHour: 5,
  magicLinkPerIpPerHour: 20,
  jobsPerUserPerHour: 20,
  uploadsPerUserPerHour: 60,
};

export const eur = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
