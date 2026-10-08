import { imageSize } from "../image-validation";
import { toProviderMask } from "../mask";
import { TransientProviderError, type ApplyInput, type DesignInput, type ImageBytes, type ImageGenerationProvider } from "./types";

/**
 * Proveedor real (OpenAI). SIN PROBAR: requiere una clave de pago y no se ha ejecutado nunca.
 * Antes de usarlo en producción: verificar nombres de modelo, parámetros y precios en la documentación actual
 * y hacer una prueba corta con 5 fotos reales con un límite de gasto bajo.
 */
export class OpenAIProvider implements ImageGenerationProvider {
  readonly name = "openai";
  constructor(
    private apiKey: string,
    private model = "gpt-image-2",
    private quality: "low" | "medium" | "high" = "medium",
    private baseUrl = "https://api.openai.com/v1",
  ) {}

  private async call(path: "generations" | "edits", form: FormData | string): Promise<ImageBytes[]> {
    const isJson = typeof form === "string";
    const res = await fetch(`${this.baseUrl}/images/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, ...(isJson ? { "Content-Type": "application/json" } : {}) },
      body: form,
    });
    if (res.status === 429 || res.status >= 500) throw new TransientProviderError(`Proveedor ocupado (${res.status})`);
    if (!res.ok) throw new Error(`Error del proveedor (${res.status})`);
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    return (data.data ?? []).map((d) => {
      const bin = atob(d.b64_json ?? "");
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return { bytes, contentType: "image/png" };
    });
  }

  async createDesign(input: DesignInput): Promise<ImageBytes> {
    if (input.reference) {
      const f = new FormData();
      f.set("model", this.model);
      f.set("prompt", input.prompt);
      f.set("quality", this.quality);
      f.set("size", "1024x1024");
      f.append("image[]", new Blob([input.reference.bytes as BlobPart], { type: input.reference.contentType }), "ref");
      const [img] = await this.call("edits", f);
      if (!img) throw new Error("El proveedor no devolvió imagen");
      return img;
    }
    const [img] = await this.call(
      "generations",
      JSON.stringify({ model: this.model, prompt: input.prompt, quality: this.quality, size: "1024x1024", n: 1 }),
    );
    if (!img) throw new Error("El proveedor no devolvió imagen");
    return img;
  }

  async applyToSkin(input: ApplyInput): Promise<ImageBytes[]> {
    const dims = imageSize(input.photo.bytes) ?? { width: 1024, height: 1024 };
    const landscape = dims.width >= dims.height;
    const f = new FormData();
    f.set("model", this.model);
    f.set("prompt", input.prompt);
    f.set("quality", this.quality);
    f.set("size", landscape ? "1536x1024" : "1024x1536");
    f.set("n", String(input.variants));
    f.append("image[]", new Blob([input.photo.bytes as BlobPart], { type: input.photo.contentType }), "photo");
    f.append("image[]", new Blob([input.design.bytes as BlobPart], { type: input.design.contentType }), "design");
    if (input.mask) {
      // OpenAI pide la máscara del mismo tamaño que la foto y con la zona a editar TRANSPARENTE.
      const mask = await toProviderMask(input.mask.bytes, dims.width, dims.height);
      f.set("mask", new Blob([mask as BlobPart], { type: "image/png" }), "mask.png");
    }
    return this.call("edits", f);
  }
}
