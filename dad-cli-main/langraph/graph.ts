import { memoryNode } from "./nodes/memory.ts";
import { diagnoserNode } from "./nodes/diagnoser.ts";
import { executorNode } from "./nodes/executor.ts";
import { validatorNode } from "./nodes/validator.ts";
import { learnerNode } from "./nodes/learner.ts";

import { anomalyDetector } from "./nodes/anomalyDetector.ts";
import { decisionEngine } from "./nodes/decisionEngine.ts";
import { controlRouter } from "./nodes/controlRouter.ts";
import { graphTracker } from "./graph-tracker.js";

// Simple state management without LangGraph
export function buildPrompt3Graph() {
  return {
    invoke: async (state: any) => {
      // Start graph tracking
      const runId = graphTracker.startRun();
      let currentState = { ...state, runId };
      
      try {
        // 1. Anomaly Detection
        currentState = anomalyDetector(currentState);
        
        // 2. Diagnosis
        currentState = await diagnoserNode(currentState);
        
        // 3. Memory
        currentState = await memoryNode(currentState);
        
        // 4. Decision
        currentState = decisionEngine(currentState);
        
        // Track decision step
        if (currentState.decision) {
          graphTracker.trackStep({
            url: currentState.current_url || "unknown",
            screenshotUrl: currentState.screenshot_url || "",
            actionTaken: currentState.decision.action,
            reasoning: currentState.decision.reasoning || "Decision made",
            status: "success"
          });
        }
        
        // 5. Executor (handled externally)
        // 6. Validator
        currentState = await validatorNode(currentState);
        
        // 7. Learner
        currentState = await learnerNode(currentState);
        
        // 8. Control
        currentState = controlRouter(currentState);
        
        return currentState;
      } catch (error) {
        // Track error step
        graphTracker.trackStep({
          url: currentState.current_url || "unknown",
          screenshotUrl: currentState.screenshot_url || "",
          actionTaken: "error",
          reasoning: "Graph execution failed",
          status: "error",
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        
        graphTracker.finishRun();
        throw error;
      } finally {
        if (currentState.control === "TERMINATE") {
          graphTracker.finishRun();
        }
      }
    }
  };
}
