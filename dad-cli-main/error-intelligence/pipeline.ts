import fs from "fs";
import { fileURLToPath } from "url";

import { loadAgentState } from "./loaders/agentStateLoader.js";
import { extractGraph } from "./loaders/graphLoader.js";
import { extractObservation } from "./loaders/observationLoader.js";
import { extractAnomalies } from "./loaders/anomalyLoader.js";

import { runContentSafetyOnScreenshots } from "./enrichers/azureVisionSafety.js";
import { analyzePerformance } from "./enrichers/azureMonitorPerf.js";
import { persistArtifacts } from "./enrichers/storageWriter.js";

import { loadObservationRun } from "./loaders/observationRunLoader.js";
import { assembleRunTrace } from "./loaders/traceAssembler.js";

import { bindAnomalyEvidence } from "./enrichers/evidenceBinder.js";

import { renderCliSummary } from "./renderers/cliReporter.js";
import { renderActionTimeline } from "./renderers/timelineRenderer.js";
import { writeJsonReport } from "./renderers/jsonReporter.js";


//
// -------------------------------------------
// AGENT STATE MODE (Prompt-3 → Prompt-4)
// -------------------------------------------
//

export async function runPrompt4Pipeline(
  agentStatePath: string,
  outPath: string
) {
  const state = loadAgentState(agentStatePath);

  const graph = extractGraph(state);
  const observation = extractObservation(state);
  const anomalies = extractAnomalies(state);

  const content_safety = await runContentSafetyOnScreenshots(observation);
  const performance = await analyzePerformance(
    observation?.network_calls ?? []
  );
  const storage = await persistArtifacts(state.run_id, observation);

  const report = {
    run_id: state.run_id,

    graph_summary: graph,
    anomalies,

    traces: observation?.network_calls ?? [],

    enrichment: {
      content_safety,
      performance
    },

    storage_refs: storage.storage_refs
  };

  renderCliSummary(report);
  writeJsonReport(outPath, report);
}


//
// -------------------------------------------
// CLI ENTRYPOINT
// -------------------------------------------
//

// ESM-compatible main module check
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const [, , inputPath, outPath] = process.argv;

  if (!inputPath || !outPath) {
    console.error("Usage:");
    console.error(" node pipeline.js <agent_state.json> <output.json>");
    console.error(" or");
    console.error(" node pipeline.js <run_folder> <output.json>");
    process.exit(1);
  }

  console.log("\n[DEBUG] input:", inputPath);
  console.log("[DEBUG] resolved:", fs.realpathSync(inputPath));
  console.log(
    "[DEBUG] isDir:",
    fs.existsSync(inputPath) && fs.lstatSync(inputPath).isDirectory()
  );

  //
  // ---------------------------------------
  // RUN FOLDER MODE (Prompt-1 runtime trace)
  // ---------------------------------------
  //
  if (fs.existsSync(inputPath) && fs.lstatSync(inputPath).isDirectory()) {
    try {
      const run = loadObservationRun(inputPath);
      const trace = assembleRunTrace(run);

      // collect raw anomalies from step data
      const rawAnomalies = run.steps
        .map(s => s.data.anomaly)
        .filter(Boolean);

      // bind screenshots + APIs as evidence (read-only)
      const enrichedAnomalies = bindAnomalyEvidence({
        anomalies: rawAnomalies,
        traces: trace
      });

      const report = {
        run_id: `runtime-${Date.now()}`,
        graph_summary: {},

        anomalies: enrichedAnomalies,
        traces: trace,

        enrichment: {
          content_safety: [],
          performance: []
        },

        storage_refs: []
      };

      renderCliSummary(report);
      renderActionTimeline(report);
      writeJsonReport(outPath, report);

      console.log("\nPipeline completed (run folder mode).\n");
      process.exit(0);

    } catch (err) {
      console.error("Run-folder pipeline failed:", err);
      process.exit(1);
    }
  }

  //
  // ---------------------------------------
  // FALLBACK → AGENT STATE MODE
  // ---------------------------------------
  //
  runPrompt4Pipeline(inputPath, outPath)
    .then(() =>
      console.log("\nPipeline completed (agent state mode).\n")
    )
    .catch(err => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}
