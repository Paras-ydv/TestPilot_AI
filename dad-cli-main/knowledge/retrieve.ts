import { qdrant, COLLECTION } from "./client.js";
import type { KnowledgeItem } from "./schema.js";
import { embedText } from "./embeddings/index.js";

interface SearchOptions {
  type?: KnowledgeItem["type"];
  topK?: number;
}

/**
 * Runtime type guard
 */
function isKnowledgeItem(obj: any): obj is KnowledgeItem {
  return (
    obj &&
    typeof obj === "object" &&
    "type" in obj &&
    "content" in obj &&
    "run_id" in obj &&
    "metadata" in obj
  );
}

/**
 * Exponential decay for old memories
 */
function decayConfidence(
  confidence: number,
  lastUsed: number
) {
  const daysOld =
    (Date.now() - lastUsed) /
    (1000 * 60 * 60 * 24);

  const lambda = 0.05; // decay rate

  return confidence * Math.exp(-lambda * daysOld);
}

export async function searchKnowledge(
  query: string,
  options?: SearchOptions
): Promise<KnowledgeItem[]> {

  const vector = await embedText(query);

  const searchParams: any = {
    vector,
    limit: options?.topK ?? 5
  };

  if (options?.type) {
    searchParams.filter = {
      must: [
        {
          key: "type",
          match: { value: options.type }
        }
      ]
    };
  }

  try {
    const res = await qdrant.search(COLLECTION, searchParams);

    return res
      .map((r) => {
        const payload = r.payload as unknown;

        if (!isKnowledgeItem(payload)) {
          return null;
        }

        const item = payload as KnowledgeItem;

        // 🔥 APPLY DECAY
        if (item.last_used) {
          item.confidence = decayConfidence(
            item.confidence ?? 0.5,
            item.last_used
          );
        }

        return {
          ...item,
          score: r.score
        };
      })
      .filter(Boolean) as KnowledgeItem[];
  } catch (error) {
    console.warn("⚠️ Search knowledge failed (is Qdrant running?):", error instanceof Error ? error.message : String(error));
    return [];
  }
}
