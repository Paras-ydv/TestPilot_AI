import { getTestRuns, getTestSteps, deleteRunData } from "./azureDb.service.js";



export async function getGraph(runId: string) {
  const steps = await getTestSteps(runId);

  // Map stateIds to their first occurrence or latest data
  const stateMap = new Map<string, any>();
  const transitions: any[] = [];

  // 1. Define nodes based on unique stateIds
  steps.forEach((step: any, index: number) => {
    const sid = step.stateId || `step-${index}`;
    if (!stateMap.has(sid)) {
      stateMap.set(sid, {
        id: sid,
        runId: step.runId,
        stepIndex: step.stepIndex,
        url: step.url || "",
        pageTitle: step.pageTitle || "",
        screenshotUrl: step.screenshotPath ? `/screenshots/${step.screenshotPath.split('/').pop()}` : "",
        timestamp: step.timestamp,
        reasoning: step.reasoning || "No reasoning provided",
        status: step.status === "success" ? "success" : "error",
        actionTaken: step.actionId, // The action that GOT us here
        selectorUsed: step.parameters?.selector || ""
      });
    }

    // Connect previous step's stateId to this step's stateId
    if (index > 0) {
      const prevSid = steps[index - 1].stateId || `step-${index - 1}`;
      transitions.push({
        id: `edge-${index}`,
        from: prevSid,
        to: sid,
        action: step.actionId
      });
    }
  });

  const nodes = Array.from(stateMap.values());
  const edges = transitions;

  // Get run summary for metadata
  const runs = await getTestRuns();
  const runInfo = runs.find((r: any) => r.runId === runId);

  return {
    nodes,
    edges,
    metadata: {
      targetUrl: runInfo?.targetUrl || "",
      status: runInfo?.status || "unknown",
      startedAt: runInfo?.startedAt,
      completedAt: runInfo?.completedAt
    }
  };
}


export async function deleteRun(runId: string) {
  return await deleteRunData(runId);
}

export async function listRuns() {
  const runs = await getTestRuns();
  return runs.sort((a: any, b: any) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}


