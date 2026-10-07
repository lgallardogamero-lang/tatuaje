import { z } from "zod";
import { BODY_ZONES, STYLES } from "./config";

const styleIds = STYLES.map((s) => s.id) as [string, ...string[]];

export const placementSchema = z.object({
  /** Centro del diseño, normalizado 0..1 sobre la foto. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /** Ancho del diseño como fracción del ancho de la foto. */
  scale: z.number().min(0.03).max(1.5),
  /** Grados. */
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0.2).max(1),
});
export type Placement = z.infer<typeof placementSchema>;

export const jobOptionsSchema = z
  .object({
    zone: z.enum(BODY_ZONES),
    description: z.string().trim().max(400).default(""),
    style: z.enum(styleIds),
    color: z.enum(["bw", "color"]),
    size: z.enum(["pequeno", "mediano", "grande"]),
    hasReference: z.boolean().default(false),
    flashId: z.string().uuid().optional(),
    placement: placementSchema,
  })
  .refine((o) => o.description.length > 0 || o.hasReference || o.flashId, {
    message: "Describe el tatuaje o sube una referencia",
    path: ["description"],
  });
export type JobOptions = z.infer<typeof jobOptionsSchema>;
