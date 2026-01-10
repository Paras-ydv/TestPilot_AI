import { AgentState } from "../types.js";

export async function executorNode(state: AgentState): Promise<AgentState> {
  try {
    const decision = state.decision;

    // 🔒 SAFETY GUARD – block risky actions
    if (
      decision?.confidence !== undefined &&
      decision.confidence < 0.4
    ) {
      console.log(
        "⚠️ Low confidence. Skipping execution."
      );

      return {
        ...state,
        execution: {
          skipped: true,
          reason: "LOW_CONFIDENCE",
          timestamp: Date.now()
        }
      };
    }

    if (!decision?.next_action) {
      return {
        ...state,
        execution: {
          skipped: true,
          reason: "NO_ACTION",
          timestamp: Date.now()
        }
      };
    }

    const { action_id, parameters } = decision.next_action;

    if (!action_id) {
      return {
        ...state,
        execution: {
          skipped: true,
          reason: "INVALID_ACTION_ID",
          timestamp: Date.now()
        }
      };
    }

    console.log("⚙️ Executing:", action_id);

    // Hook into runtime system through state
    if (state.runtime?.execute) {
      try {
        await state.runtime.execute(action_id, parameters);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Execution failed:", errorMessage);
        return {
          ...state,
          execution: {
            action_id,
            parameters,
            timestamp: Date.now(),
            skipped: true,
            reason: "EXECUTION_ERROR"
          }
        };
      }
    } else {
      console.warn("⚠️ No runtime executor available");
      return {
        ...state,
        execution: {
          action_id,
          parameters,
          timestamp: Date.now(),
          skipped: true,
          reason: "NO_RUNTIME_EXECUTOR"
        }
      };
    }

    return {
      ...state,
      execution: {
        action_id,
        parameters,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Executor node failed:", errorMessage);
    return {
      ...state,
      execution: {
        skipped: true,
        reason: "NODE_ERROR",
        timestamp: Date.now()
      }
    };
  }
}
