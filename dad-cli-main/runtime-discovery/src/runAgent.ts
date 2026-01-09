import fs from "fs";
import { discoverUI, executeAction } from "./agentRuntime.js";
import { runPrompt3 } from "../../langraph/index.ts";
import { AgentState, AgentStep, ActionContract } from "./types.js";
import { storeKnowledge } from "../../knowledge/store.ts";
import { searchKnowledge } from "../../knowledge/retrieve.ts";

const args = process.argv.slice(2);
const headfulIndex = args.indexOf('--headful');
const headless = headfulIndex === -1;

// Remove --headful flag from args to get URL
if (headfulIndex !== -1) {
  args.splice(headfulIndex, 1);
}

const targetUrl = args[0];

if (!targetUrl) {
  console.error("Usage: npm run start <url> or npm run start-headful <url>");
  process.exit(1);
}

if (!headless) {
  console.log("🖥️ Running in headful mode (browser visible)");
  console.log("🕰️ Browser will stay open during automation...");
}

/* ----------------------------------------
   Runtime Bridge Function
----------------------------------------- */
async function createRuntimeExecutor(targetUrl: string) {
  return async (action_id: string, parameters: Record<string, any>): Promise<void> => {
    const action: ActionContract = { action_id, parameters };
    await executeAction(action);
  };
}

/* ----------------------------------------
   Persist Agent Knowledge
----------------------------------------- */
async function persistRunKnowledge(state: AgentState) {
  try {
    for (const step of state.steps) {
      try {
        // ❌ Store failures
        if (step.observation.skipped) {
          await storeKnowledge({
            type: "error",
            content: `Action ${step.action.action_id} failed`,
            run_id: state.run_id,
            metadata: {
              endpoint: state.runtime.url,
              env: "runtime",
              timestamp: new Date().toISOString()
            }
          });
        }

        // ⚠️ Store anomalies
        if (step.anomalies && step.anomalies.length > 0) {
          for (const anomaly of step.anomalies) {
            await storeKnowledge({
              type: "error",
              content: JSON.stringify(anomaly),
              run_id: state.run_id,
              metadata: {
                endpoint: state.runtime.url,
                env: "runtime",
                timestamp: new Date().toISOString()
              }
            });
          }
        }

        // ✅ Store successful flows with solution
        if (!step.observation.skipped) {
          await storeKnowledge({
            type: "flow",
            content: `Successful action: ${step.action.action_id}`,
            solution: step.action.action_id, // Add solution field
            confidence: 0.8,
            run_id: state.run_id,
            metadata: {
              endpoint: state.runtime.url,
              env: "runtime",
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error("❌ Failed to store knowledge for step:", step.step, error instanceof Error ? error.message : String(error));
      }
    }

    // Store globally-explored actions for deduplication in future runs
    const exploredActions = new Set<string>();
    for (const step of state.steps) {
      if (!step.observation.skipped) {
        exploredActions.add(step.action.action_id);
      }
    }

    console.log(`📚 Storing ${exploredActions.size} globally-explored actions to KB...`);
    for (const action of exploredActions) {
      try {
        const actionSig = `action_explored:${action}`;
        await storeKnowledge({
          type: "flow",
          content: `Explored action: ${action}`,
          error_signature: actionSig, // Use for exact matching
          solution: action,
          confidence: 1.0, // High confidence for successfully explored
          run_id: state.run_id,
          metadata: {
            endpoint: state.runtime.url,
            env: "runtime",
            timestamp: new Date().toISOString(),
            tags: ["action_explored", "global_dedup"]
          }
        });
      } catch (error) {
        console.warn(`⚠️ Failed to store action ${action}:`, error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    console.error("❌ Failed to persist run knowledge:", error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  try {
    const state: AgentState = {
      schema_version: "1.0",
      run_id: `run-${Date.now()}`,
      runtime: {
        url: targetUrl,
        browser: "chromium",
        timestamp: new Date().toISOString(),
        execute: await createRuntimeExecutor(targetUrl) // Add runtime bridge
      },
      steps: []
    };

    console.log("[Runtime] Target URL:", targetUrl);

    // Initial UI discovery
    try {
      state.ui_state = await discoverUI(targetUrl, headless);
    } catch (error) {
      console.error("❌ Initial UI discovery failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // Track which actions have been tried at each state (for DFS exploration)
    const stateActionMap = new Map<string, Set<string>>();

    // Track consecutive backtracking to detect loops
    let consecutiveBacks = 0;

    // Increase limit for exploration
    for (let step = 0; step < 100; step++) {
      try {
        console.log(`\n[Loop] Step ${step + 1}`);
        console.log("[DEBUG] Available actions:", state.ui_state?.available_actions);

        /* --------------------------------------
           🧠 KNOWLEDGE CHECK (Stop if known)
        ---------------------------------------*/
        const currentUrl = state.runtime.url; // Note: We might want the actual current page URL if it changes
        const actionCount = state.ui_state?.available_actions?.length || 0;

        // Simple signature for "Being at this state"
        // In a real app, this should include the route from the browser, not just targetUrl
        const stateSignature = `state_visit:${state.ui_state?.route || 'unknown'}:${actionCount}`;

        console.log("🧠 Checking KB for state:", stateSignature);

        let knownStates: any[] = [];
        try {
          knownStates = await searchKnowledge(stateSignature, {
            type: "observation",
            topK: 1
          });
        } catch (error) {
          console.warn("⚠️ Qdrant/KB seems offline. Skipping knowledge check.");
        }

        if (knownStates.length > 0 && knownStates[0].confidence && knownStates[0].confidence > 0.9) {
          console.log(`🛑 TERMINATING: Reached a known knowledge node!`);
          console.log(`   Matches: ${knownStates[0].content} (ID: ${knownStates[0].id})`);
          break;
        }

        // ---------------------------------
        // DFS: Get current state and track tried actions
        // ---------------------------------
        const currentStateKey = state.ui_state?.route || 'unknown';
        if (!stateActionMap.has(currentStateKey)) {
          stateActionMap.set(currentStateKey, new Set());
        }
        const triedAtThisState = stateActionMap.get(currentStateKey)!;

        // Get untried actions at current state
        const untriedActions = state.ui_state?.available_actions
          ?.filter(a => !triedAtThisState.has(a)) || [];

        console.log(`[DFS] State: ${currentStateKey}, Untried: ${untriedActions.length}/${state.ui_state?.available_actions?.length || 0}`);

        // ---------------------------------
        // FORCE modal dismissal first
        // ---------------------------------
        const modalActions = untriedActions.filter(actionId => {
          const lowerAction = actionId.toLowerCase();
          return lowerAction.includes('close') ||
            lowerAction.includes('cancel') ||
            lowerAction.includes('ok') ||
            lowerAction.includes('dismiss') ||
            lowerAction.includes('accept') ||
            lowerAction.includes('continue') ||
            lowerAction.includes('agree') ||
            lowerAction.includes('enter') ||
            lowerAction.includes('18') ||
            lowerAction.includes('older') ||
            lowerAction.includes('confirm') ||
            lowerAction.includes('yes');
        });

        const untriedModalAction = modalActions[0];

        // If there's an untried modal action, prioritize it
        if (untriedModalAction) {
          console.log(`🚨 Forcing modal dismissal: ${untriedModalAction}`);
          state.next_action = {
            action_id: untriedModalAction,
            parameters: {}
          };
          state.control = "CONTINUE";
        }
        // ---------------------------------
        // Prompt-3 decision (now returns full state)
        // ---------------------------------
        else {
          let updatedState;
          try {
            updatedState = await runPrompt3(state);
            Object.assign(state, updatedState);
          } catch (error) {
            console.error("❌ LangGraph decision failed:", error instanceof Error ? error.message : String(error));
            // Force fallback on LangGraph failure
            state.control = "TERMINATE";
            state.next_action = undefined;
          }
        }

        // ---------------------------------
        // FORCE fallback if Prompt-3 stops OR auto-DFS
        // ---------------------------------
        if (state.control !== "CONTINUE" || !state.next_action) {
          console.log("[Loop] Selecting next action via DFS...");

          // Check if all actions exhausted at current state
          if (untriedActions.length === 0) {
            console.log("[DFS] All actions explored at current state. BACKTRACKING...");
            state.next_action = {
              action_id: "BROWSER_BACK",
              parameters: {}
            };
            state.control = "CONTINUE";
          } else {
            // Prioritize navigation links for exploration
            const navLinks = untriedActions.filter(a => a.startsWith('link_'));
            const otherActions = untriedActions.filter(a => !a.startsWith('link_'));

            const fallback = navLinks.length > 0 ? navLinks[0] : otherActions[0];

            console.log(`[DFS] Selected: ${fallback}`);
            state.next_action = {
              action_id: fallback,
              parameters: {}
            };
            state.control = "CONTINUE";
          }
        }

        // Mark action as tried for current state
        triedAtThisState.add(state.next_action.action_id);

        // Track backtracking to detect loops
        if (state.next_action.action_id === "BROWSER_BACK") {
          consecutiveBacks++;
          if (consecutiveBacks > 3) {
            console.log("🛑 Stuck in backtracking loop (>3 consecutive backs). Terminating exploration.");
            break;
          }
        } else {
          consecutiveBacks = 0; // Reset on normal action
        }

        console.log("[Loop] Executing:", state.next_action.action_id);

        // ---------------------------------
        // Execute action
        // ---------------------------------
        let observation;
        try {
          observation = await executeAction(state.next_action);
        } catch (error) {
          console.error("❌ Action execution failed:", error instanceof Error ? error.message : String(error));
          observation = {
            actionId: state.next_action.action_id,
            networkCalls: [],
            consoleErrors: [],
            screenshotPath: "",
            skipped: true
          };
        }

        // ---------------------------------
        // Refresh UI and detect changes
        // ---------------------------------
        const oldActions = new Set(state.ui_state?.available_actions || []);
        const oldModalCount = state.ui_state?.available_actions?.filter(a =>
          a.toLowerCase().includes('close') ||
          a.toLowerCase().includes('cancel') ||
          a.toLowerCase().includes('ok')
        ).length || 0;

        try {
          state.ui_state = await discoverUI(targetUrl, headless);
        } catch (error) {
          console.error("❌ UI refresh failed:", error instanceof Error ? error.message : String(error));
          // Continue with existing UI state
        }

        const newActions = new Set(state.ui_state?.available_actions || []);
        const newModalCount = state.ui_state?.available_actions?.filter(a =>
          a.toLowerCase().includes('close') ||
          a.toLowerCase().includes('cancel') ||
          a.toLowerCase().includes('ok')
        ).length || 0;

        // Detect significant state changes
        const actionsAdded = [...newActions].filter(a => !oldActions.has(a));
        const actionsRemoved = [...oldActions].filter(a => !newActions.has(a));
        const modalDismissed = oldModalCount > 0 && newModalCount === 0;

        if (actionsAdded.length > 0) {
          console.log(`🆕 New elements appeared:`, actionsAdded);
        }
        if (actionsRemoved.length > 0) {
          console.log(`🗑️ Elements disappeared:`, actionsRemoved);
        }
        if (modalDismissed) {
          console.log(`✅ Modal dismissed - UI unlocked`);
        }



        const agentStep: AgentStep = {
          step,
          action: state.next_action,
          observation: observation,
          anomalies: state.anomalies ?? []
        };

        // ---------------------------------
        // Store State Visitation (Mapping the graph)
        // ---------------------------------
        if (!agentStep.observation.skipped) {
          try {
            const stateSig = `state_visit:${state.ui_state?.route || 'unknown'}:${state.ui_state?.available_actions?.length || 0}`;
            await storeKnowledge({
              type: "observation",
              content: `Visited state: ${state.ui_state?.title}`,
              error_signature: stateSig, // Use error_signature for the unique lookup key
              run_id: state.run_id,
              confidence: 1.0,
              metadata: {
                timestamp: new Date().toISOString(),
                endpoint: targetUrl,
                tags: ["state_map"]
              }
            });
          } catch (error) {
            console.warn("⚠️ Failed to store state in KB (Qdrant offline?):", error instanceof Error ? error.message : String(error));
          }
        }

        state.steps.push(agentStep);
      } catch (error) {
        console.error(`❌ Step ${step + 1} failed:`, error instanceof Error ? error.message : String(error));
        // Continue exploration despite errors
      }
    }

    // ---------------------------------
    // Save run to file
    // ---------------------------------
    try {
      fs.writeFileSync(
        `runs/${state.run_id}.json`,
        JSON.stringify(state, null, 2)
      );
    } catch (error) {
      console.error("❌ Failed to save run file:", error instanceof Error ? error.message : String(error));
    }

    // ---------------------------------
    // Persist knowledge to KB
    // ---------------------------------
    await persistRunKnowledge(state);

    console.log("✅ Run complete:", state.run_id);
  } catch (error) {
    console.error("❌ Main execution failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Runtime failed:");
  console.dir(err, { depth: null });
  process.exit(1);
});

