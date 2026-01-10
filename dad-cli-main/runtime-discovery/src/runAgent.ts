import { discoverUI, executeAction, initializeBrowser, closeBrowser, takeScreenshot } from "./agentRuntime.js";
import { runPrompt3 } from "../../langraph/index.js";
import { AgentState, AgentStep, ActionContract } from "./types.js";
import { storeKnowledge } from "../../knowledge/store.js";
import { searchKnowledge } from "../../knowledge/retrieve.js";
import { validateUrl } from "./urlValidator.js";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: 'runtime-discovery/.env' });

const cosmosApi = axios.create({
  baseURL: "http://localhost:5050",
  headers: {
    "x-api-key": "daddychill123supersecretkey"
  }
});

const insertTestRun = async (data: any) => {
  try {
    return await cosmosApi.post("/db/test-runs", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert test run:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const insertTestStep = async (data: any) => {
  try {
    return await cosmosApi.post("/db/test-steps", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert test step:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const insertAnomaly = async (data: any) => {
  try {
    return await cosmosApi.post("/db/anomalies", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert anomaly:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const updateTestRun = async (runId: string, data: any) => {
  try {
    return await cosmosApi.put(`/db/test-runs/${runId}`, data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to update test run:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const args = process.argv.slice(2);
const headfulIndex = args.indexOf('--headful');
const headless = headfulIndex === -1;

if (headfulIndex !== -1) {
  args.splice(headfulIndex, 1);
}

const targetUrl = args[0];

if (!targetUrl) {
  console.error("Usage: npm run start <url> or npm run start-headful <url>");
  process.exit(1);
}

try {
  validateUrl(targetUrl);
} catch (error) {
  console.error("❌ Invalid URL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function createRuntimeExecutor(targetUrl: string) {
  return async (action_id: string, parameters: Record<string, any>): Promise<void> => {
    const action: ActionContract = { action_id, parameters };
    await executeAction(action);
  };
}

async function main() {
  const graphRunId = `run-${Date.now()}`;
  let stepIndex = 0;

  try {
    const state: AgentState = {
      schema_version: "1.0",
      run_id: graphRunId,
      runtime: {
        url: targetUrl,
        browser: "chromium",
        timestamp: new Date().toISOString(),
        execute: await createRuntimeExecutor(targetUrl)
      },
      steps: []
    };

    await insertTestRun({
      runId: graphRunId,
      targetUrl,
      startedAt: new Date().toISOString(),
      status: "running",
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      anomaliesCount: 0
    });

    try {
      await initializeBrowser(headless);
    } catch (error) {
      console.error("❌ Failed to initialize browser:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    try {
      state.ui_state = await discoverUI(targetUrl, headless);
    } catch (error) {
      console.error("❌ Initial UI discovery failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    let consecutiveFailures = 0;
    let noActionSteps = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    const MAX_NO_ACTION_STEPS = 3;

    for (let step = 0; step < 100; step++) {
      try {
        if (state.ui_state?.route === '/error' && step > 5) {
          console.log("🛑 Stuck in error route - terminating");
          break;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`🛑 Too many consecutive failures (${consecutiveFailures}) - terminating`);
          break;
        }

        if (noActionSteps >= MAX_NO_ACTION_STEPS) {
          console.log(`🛑 No available actions for ${noActionSteps} steps - terminating`);
          break;
        }

        console.log(`\n[Loop] Step ${step + 1}`);

        // Capture state ID BEFORE execution to attribute the action correctly
        const preExecutionStateId = state.ui_state?.state_id;

        // Capture screenshot for graph tracking
        try {
          const screenshotPath = await takeScreenshot(`state_${preExecutionStateId}`);
          state.screenshot_url = screenshotPath;
        } catch (err) {
          console.warn("⚠️ Failed to capture state screenshot:", err);
        }

        try {
          const updatedState = await runPrompt3(state);
          state.next_action = updatedState.next_action;
          state.reasoning = updatedState.reasoning || updatedState.decision?.reasoning;
        } catch (error) {
          console.error("❌ Agent logic failed:", error instanceof Error ? error.message : String(error));
          state.reasoning = `Agent logic failed during decision phase: ${error instanceof Error ? error.message : String(error)}`;
          consecutiveFailures++;
        }

        console.log("[DEBUG] Next action:", state.next_action?.action_id);

        if (!state.next_action || !state.ui_state?.available_actions?.length) {
          noActionSteps++;
        } else {
          noActionSteps = 0;
        }

        let observation;
        try {
          if (state.next_action) {
            observation = await executeAction(state.next_action);
          } else {
            const idleScreenshot = await takeScreenshot("idle");
            observation = {
              actionId: "no_action",
              networkCalls: [],
              consoleErrors: [],
              screenshotPath: idleScreenshot,
              skipped: true
            };
          }
        } catch (error) {
          console.error("❌ Action execution failed:", error instanceof Error ? error.message : String(error));
          consecutiveFailures++;
          const errorScreenshot = await takeScreenshot("error");
          observation = {
            actionId: state.next_action?.action_id || "unknown",
            networkCalls: [],
            consoleErrors: [error instanceof Error ? error.message : String(error)],
            screenshotPath: errorScreenshot,
            skipped: true
          };
        }

        try {
          state.ui_state = await discoverUI(targetUrl, headless);
          if (state.ui_state && state.ui_state.available_actions.length > 0) {
            consecutiveFailures = 0;
          }
        } catch (error) {
          console.warn("⚠️ UI refresh failed:", error instanceof Error ? error.message : String(error));
          consecutiveFailures++;
        }

        // Update internal state steps for memory-based decisions
        state.steps.push({
          step: stepIndex,
          action: state.next_action || { action_id: "none", parameters: {} },
          observation: observation,
          state_id: preExecutionStateId,
          anomalies: state.anomalies || []
        });

        await insertTestStep({
          runId: graphRunId,
          stepIndex: stepIndex++,
          actionId: state.next_action?.action_id || "unknown",
          actionType: state.next_action?.action_id?.split(":")[0] || (state.next_action ? "unknown" : "idle"),
          parameters: state.next_action?.parameters || {},
          timestamp: new Date().toISOString(),
          status: observation.skipped ? "failed" : "success",
          screenshotPath: observation.screenshotPath || "",
          networkCalls: observation.networkCalls.length,
          consoleErrors: observation.consoleErrors,
          stateId: preExecutionStateId, // Essential for branching
          reasoning: state.reasoning || (state.next_action ? "Executing planned action." : "No action determined by agent.")
        });

        if (state.anomalies && state.anomalies.length > 0) {
          for (const anomaly of state.anomalies) {
            await insertAnomaly({
              runId: graphRunId,
              stepIndex: stepIndex - 1,
              ...anomaly
            });
          }
        }
      } catch (loopError) {
        console.error("❌ Step loop error:", loopError);
        consecutiveFailures++;
      }
    }

    await updateTestRun(graphRunId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      totalSteps: stepIndex
    });

  } catch (error) {
    console.error("❌ Main execution failed:", error);
  } finally {
    await closeBrowser();
    console.log(`\n✅ Run completed. Run ID: ${graphRunId}`);
  }
}

main();
