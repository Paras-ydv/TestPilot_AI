import { searchKnowledge } from "../../knowledge/retrieve.js";
import type { KnowledgeItem } from "../../knowledge/schema.js";

export async function memoryNode(state: any) {
  const query = state.diagnosis?.error_signature || state.last_error || state.anomalies?.map((a: any) => a.message || a.type).join(" ") || "agent runtime behavior";

  // Multi-type knowledge search
  const [errors, fixes, patterns] = await Promise.all([
    searchKnowledge(query, { type: "error", topK: 2 }),
    searchKnowledge(query, { type: "fix", topK: 3 }),
    searchKnowledge(query, { type: "pattern", topK: 2 })
  ]);

  const allMemories = [...errors, ...fixes, ...patterns]
    .filter(m => (m.confidence ?? 0) > 0.3)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const avgConfidence = allMemories.length === 0 ? 0 : allMemories.reduce((acc, m) => acc + (m.confidence ?? 0), 0) / allMemories.length;

  console.log(`🧠 Memory: ${allMemories.length} items | confidence=${avgConfidence.toFixed(2)}`);

  return {
    ...state,
    knowledge_context: {
      query,
      memories: allMemories,
      confidence: avgConfidence,
      has_solutions: fixes.length > 0
    }
  };
}
