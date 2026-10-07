import type { Placement } from "../schema";

export interface ImageBytes {
  bytes: Uint8Array;
  contentType: string;
}

export interface DesignInput {
  prompt: string;
  /** Texto original resumido; lo usa el proveedor simulado para generar un diseño determinista. */
  seed: string;
  style: string;
  color: "bw" | "color";
  reference?: ImageBytes;
}

export interface ApplyInput {
  photo: ImageBytes;
  /** Máscara opcional: blanco = zona donde va el tatuaje. */
  mask?: ImageBytes;
  design: ImageBytes;
  prompt: string;
  variants: number;
  placement: Placement;
  seed: string;
}

/**
 * Único punto de contacto con el proveedor de IA. Para cambiar de proveedor
 * basta con implementar esta interfaz y registrarla en `getProvider`.
 */
export interface ImageGenerationProvider {
  readonly name: string;
  createDesign(input: DesignInput): Promise<ImageBytes>;
  applyToSkin(input: ApplyInput): Promise<ImageBytes[]>;
}

/** Error que el ejecutor puede reintentar (límite de tasa, 5xx, red). */
export class TransientProviderError extends Error {}
