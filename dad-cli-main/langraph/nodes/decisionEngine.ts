import { AgentState, DecisionOutput } from "../types.js";
import type { KnowledgeItem } from "../../knowledge/schema.js";
import { generateIntelligentInput } from "../utils/inputGenerator.js";

export function decisionEngine(state: AgentState): AgentState {
  try {
    const actions = state.ui_state?.available_actions ?? [];
    const steps = state.steps ?? [];

    const memoryContext = (state as any).knowledge_context as {
      memories?: KnowledgeItem[];
      confidence?: number;
    } | undefined;

    let decision: DecisionOutput;

    /* -----------------------------------------
       1️⃣ ENHANCED MEMORY RESOLUTION
    ------------------------------------------*/

    /* -----------------------------------------
       1️⃣ ENHANCED MEMORY RESOLUTION
    ------------------------------------------*/

    let memoryDecisionMade = false;

    if (
      memoryContext &&
      memoryContext.memories?.length
    ) {
      try {
        // Filter by type and confidence
        const fixes = memoryContext.memories
          .filter(m => m.type === "fix" && (m.confidence ?? 0) > 0.6)
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

        const patterns = memoryContext.memories
          .filter(m => m.type === "pattern" && (m.confidence ?? 0) > 0.5)
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

        // Prioritize proven fixes
        if (fixes.length > 0) {
          const best = fixes[0];
          console.log(`🎯 Applying proven fix: ${best.solution} (${(best.confidence * 100).toFixed(0)}% confidence)`);

          decision = {
            next_action: {
              action_id: best.solution,
              parameters: best.metadata?.parameters || {}
            },
            reasoning: `Applying proven fix: ${best.solution}. This solution was previously successful for a similar error signature.`,
            control: "CONTINUE",
            confidence: best.confidence
          };
          memoryDecisionMade = true;
        }
        // Use patterns for guidance
        else if (patterns.length > 0) {
          const pattern = patterns[0];
          console.log(`🔍 Following pattern: ${pattern.content}`);

          decision = {
            next_action: {
              action_id: pattern.solution || "investigate",
              parameters: {}
            },
            reasoning: `Following discovered pattern: ${pattern.content}. This pattern suggests a likely path forward based on historical data.`,
            control: "CONTINUE",
            confidence: pattern.confidence
          };
          memoryDecisionMade = true;
        }
      } catch (error) {
        console.error("❌ Memory resolution failed:", error instanceof Error ? error.message : String(error));
        // Fallthrough to exploration
      }
    }

    /* -----------------------------------------
       2️⃣ FALLBACK → EXPLORATION LOGIC
    ------------------------------------------*/

    if (!memoryDecisionMade) {
      const currentStateId = state.ui_state?.state_id || "unknown";

      // 🔴 Nothing discovered
      if (actions.length === 0) {
        console.log("⚠️ No actions discovered - checking for backtrack options");
        const canBacktrack = steps.length > 0 && !steps[steps.length - 1].action.action_id.includes("BROWSER_BACK");

        if (canBacktrack) {
          decision = {
            next_action: { action_id: "BROWSER_BACK", parameters: {} },
            reasoning: "No actions found on this page. Backtracking to parent state.",
            control: "CONTINUE"
          };
        } else {
          decision = {
            next_action: null,
            reasoning: "No available actions and cannot backtrack. Terminating.",
            control: "TERMINATE"
          };
        }
      } else {
        // 🟢 ADAPTIVE exploration based on state history
        const visitedStates = new Set(steps.map(s => s.state_id).filter(id => !!id));
        const actionVisitCount = new Map<string, number>();

        // Count how many times each action has been taken in THIS SPECIFIC state
        steps.filter(s => s.state_id === currentStateId).forEach(s => {
          const id = s.action.action_id;
          actionVisitCount.set(id, (actionVisitCount.get(id) || 0) + 1);
        });

        // 1. Prioritize unvisited actions in the current state
        let nextActionObj = actions.find((a: any) => !actionVisitCount.has(a.id || a));
        let next = nextActionObj?.id || nextActionObj;

        if (!next) {
          // 🔙 BACKTRACKING LOGIC: If current state is fully explored
          console.log(`🔄 State ${currentStateId} fully explored. Attempting backtrack.`);

          // Check if we've already backtracked from here too many times
          const backtrackCount = steps.filter(s => s.state_id === currentStateId && s.action.action_id === "BROWSER_BACK").length;

          if (backtrackCount < 1 && steps.length > 0) {
            decision = {
              next_action: { action_id: "BROWSER_BACK", parameters: {} },
              reasoning: "Current state fully explored. Backtracking to discover other branches.",
              control: "CONTINUE"
            };
          } else {
            decision = {
              next_action: null,
              reasoning: `State ${currentStateId} and its branches fully explored.`,
              control: "TERMINATE"
            };
          }
        } else {
          console.log("🤔 Exploring action:", next);

          const parameters: Record<string, any> = {
            selector: nextActionObj?.selector || ""
          };
          if (next.includes("input") || next.includes("textarea")) {
            parameters.value = generateIntelligentInput({
              actionId: next,
              elementType: next.includes("textarea") ? "textarea" : "input"
            });
          } else if (next.includes("select")) {
            parameters.index = 0;
          } else if (next.includes("checkbox") || next.includes("radio")) {
            parameters.checked = true;
          }

          decision = {
            next_action: {
              action_id: next,
              parameters
            },
            reasoning: `Exploring unvisited action '${next}' in state ${currentStateId}.`,
            control: "CONTINUE",
            confidence: Math.max(0.6, 1.0 - (steps.length * 0.05))
          };
        }
      }
    }

    return {
      ...state,
      decision,
      next_action: decision.next_action,
      reasoning: decision.reasoning,
      control: decision.control
    };
  } catch (error) {
    console.error("❌ Decision engine failed:", error instanceof Error ? error.message : String(error));
    return {
      ...state,
      decision: {
        next_action: null,
        reasoning: `Decision engine error: ${error instanceof Error ? error.message : String(error)}`,
        control: "TERMINATE"
      },
      next_action: null,
      reasoning: "Emergency termination due to internal decision engine error.",
      control: "TERMINATE"
    };
  }
}
