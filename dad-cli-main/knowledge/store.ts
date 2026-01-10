import { qdrant, COLLECTION } from "./client.js";
import type { KnowledgeItem } from "./schema.js";
import { v4 as uuidv4 } from "uuid";
import { embedText } from "./embeddings/index.js";

/**
 * Normalize text into stable signature
 */
export function normalizeSignature(text: string) {
  try {
    if (!text || typeof text !== 'string') {
      return "unknown_signature";
    }

    return text
      .toLowerCase()
      .replace(/\d+/g, "N")
      .replace(/\/[a-zA-Z0-9-_]+/g, "/:param")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  } catch (error) {
    console.error("❌ Failed to normalize signature:", error instanceof Error ? error.message : String(error));
    return "error_signature";
  }
}

/**
 * Compute confidence from history
 */
function computeConfidence(
  success: number,
  failure: number
) {
  try {
    const total = success + failure;

    if (total === 0) return 0.5; // neutral start
    if (isNaN(success) || isNaN(failure) || success < 0 || failure < 0) {
      return 0.5; // fallback for invalid data
    }

    return Math.min(1.0, Math.max(0.0, success / total)); // clamp to [0,1]
  } catch (error) {
    console.error("❌ Failed to compute confidence:", error instanceof Error ? error.message : String(error));
    return 0.5;
  }
}

/**
 * Store structured knowledge into Qdrant
 */
export async function storeKnowledge(item: KnowledgeItem) {
  try {
    if (!item) {
      throw new Error("Invalid item: item is null or undefined");
    }

    if (!item.content) {
      throw new Error("Invalid item: content is required");
    }

    if (!item.run_id) {
      throw new Error("Invalid item: run_id is required");
    }

    // Auto ID
    if (!item.id) {
      item.id = uuidv4();
    }

    // Stable signature
    if (!item.error_signature) {
      item.error_signature = normalizeSignature(item.content);
    }

    // Defaults
    item.created_at = Date.now();
    item.usage_count ??= 0;

    // Phase 5 reinforcement defaults
    item.success_count ??= 0;
    item.failure_count ??= 0;

    // REAL confidence
    item.confidence = computeConfidence(
      item.success_count,
      item.failure_count
    );

    // IMPORTANT: embed signature, not raw content
    let vector;
    try {
      vector = await embedText(item.error_signature);
    } catch (error) {
      console.error("❌ Failed to embed text:", error instanceof Error ? error.message : String(error));
      throw new Error("Failed to generate embedding");
    }

    try {
      await qdrant.upsert(COLLECTION, {
        wait: true,
        points: [
          {
            id: item.id,
            vector,
            payload: item as unknown as Record<string, unknown>
          }
        ]
      });
    } catch (error) {
      console.error("❌ Failed to store in Qdrant:", error instanceof Error ? error.message : String(error));
      throw new Error("Failed to store knowledge in vector database");
    }

    console.log(
      `🧠 Stored: ${item.type} | success=${item.success_count} failure=${item.failure_count} confidence=${item.confidence.toFixed(
        2
      )}`
    );
  } catch (error) {
    console.warn("⚠️ Store knowledge failed (is Qdrant running?):", error instanceof Error ? error.message : String(error));
    // Non-blocking: don't re-throw
  }
}
