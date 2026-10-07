import { getEnv } from "../env";
import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import type { ImageGenerationProvider } from "./types";

export function getProvider(): ImageGenerationProvider {
  const env = getEnv();
  if (env.PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("PROVIDER=openai requiere OPENAI_API_KEY");
    return new OpenAIProvider(env.OPENAI_API_KEY);
  }
  return new MockProvider();
}

export type { ImageGenerationProvider } from "./types";
