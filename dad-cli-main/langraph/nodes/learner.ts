import { storeKnowledge } from "../../knowledge/store.js";
import { updateKnowledgeConfidence } from "../../knowledge/feedback.js";

export async function learnerNode(state: any) {
  const diag = state.diagnosis;
  const exec = state.execution;
  const val = state.validation;
  const decision = state.decision;
  const knowledge = state.knowledge_context;

  // Store exploration knowledge even without errors
  if (decision?.next_action && val?.success) {
    await storeKnowledge({
      type: "exploration",
      content: `Successfully executed ${decision.next_action.action_id}`,
      run_id: state.run_id,
      error_signature: `${decision.next_action.action_id}_success`,
      solution: decision.next_action.action_id,
      outcome: "success",
      success_count: 1,
      failure_count: 0,
      metadata: {
        timestamp: new Date().toISOString(),
        url: state.current_url,
        parameters: decision.next_action.parameters,
        tags: ["exploration", "success"]
      }
    });
  }

  if (!diag || !exec || !val) {
    return state;
  }

  console.log("📚 Learning from result");

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
