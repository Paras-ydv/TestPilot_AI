import { embedLocal } from "./local.js";
import { embedAzure } from "./azure.js";

export async function embedText(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || "local";

  if (provider === "azure") {
    console.log("🔵 Using Azure embeddings");
    return embedAzure(text);
  }

  console.log("🟢 Using local embeddings");
  return embedLocal(text);
}
