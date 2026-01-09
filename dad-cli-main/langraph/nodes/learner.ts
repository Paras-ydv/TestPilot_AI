import { storeKnowledge } from "../../knowledge/store.ts";
import { updateKnowledgeConfidence } from "../../knowledge/feedback.ts";

export async function learnerNode(state: any) {
  const diag = state.diagnosis;
  const exec = state.execution;
  const val = state.validation;
  const decision = state.decision;
  const knowledge = state.knowledge_context;

  if (!diag || !exec || !val) {
    return state;
  }

  console.log("📚 Enhanced learning from result");

  // Update existing knowledge confidence
  if (knowledge?.memories?.length && decision?.source === "knowledge_base") {
    const usedKnowledge = knowledge.memories.find((m: any) => m.solution === exec.action_id);
    if (usedKnowledge?.id) {
      await updateKnowledgeConfidence(usedKnowledge.id, val.success, 0.15);
    }
  }

  // Store new fix knowledge
  await storeKnowledge({
    type: "fix",
    content: diag.raw_error,
    run_id: state.run_id,
    error_signature: diag.error_signature,
    root_cause: diag.root_cause,
    solution: exec.action_id,
    outcome: val.success ? "success" : "failure",
    success_count: val.success ? 1 : 0,
    failure_count: val.success ? 0 : 1,
    metadata: {
      timestamp: new Date().toISOString(),
      parameters: exec.parameters,
      execution_time: exec.duration,
      tags: ["auto-learn", val.success ? "success" : "failure"]
    }
  });

  // Store interaction pattern for successful KB usage
  if (decision?.source === "knowledge_base" && val.success) {
    await storeKnowledge({
      type: "pattern",
      content: `KB-driven success: ${decision.reasoning}`,
      run_id: state.run_id,
      solution: exec.action_id,
      success_count: 1,
      failure_count: 0,
      metadata: {
        timestamp: new Date().toISOString(),
        kb_confidence: knowledge.confidence,
        tags: ["kb-success"]
      }
    });
  }

  return state;
}
