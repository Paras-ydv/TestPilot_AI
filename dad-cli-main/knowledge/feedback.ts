import { qdrant, COLLECTION } from "./client.ts";

/**
 * Update knowledge confidence based on real usage outcomes
 */
export async function updateKnowledgeConfidence(
  knowledgeId: string,
  wasSuccessful: boolean,
  boost: number = 0.1
) {
  try {
    const point = await qdrant.retrieve(COLLECTION, { ids: [knowledgeId] });
    
    if (point.length === 0) return;
    
    const payload = point[0].payload as any;
    
    // Update counters
    if (wasSuccessful) {
      payload.success_count = (payload.success_count || 0) + 1;
      payload.confidence = Math.min(1.0, (payload.confidence || 0.5) + boost);
    } else {
      payload.failure_count = (payload.failure_count || 0) + 1;
      payload.confidence = Math.max(0.0, (payload.confidence || 0.5) - boost);
    }
    
    payload.last_used = Date.now();
    payload.usage_count = (payload.usage_count || 0) + 1;
    
    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: [{
        id: knowledgeId,
        vector: point[0].vector,
        payload
      }]
    });
    
    console.log(`📈 Updated knowledge ${knowledgeId}: confidence=${payload.confidence.toFixed(2)}`);
  } catch (error) {
    console.error("❌ Failed to update knowledge confidence:", error);
  }
}

/**
 * Batch update multiple knowledge items
 */
export async function batchUpdateConfidence(
  updates: Array<{ id: string; success: boolean; boost?: number }>
) {
  await Promise.all(
    updates.map(({ id, success, boost }) => 
      updateKnowledgeConfidence(id, success, boost)
    )
  );
}