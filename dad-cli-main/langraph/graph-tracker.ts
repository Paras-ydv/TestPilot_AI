import { graphStorage } from "../storage/graph-storage.js";

export class GraphTracker {
  private currentRunId: string | null;
  private lastNodeId: string | null;

  constructor() {
    this.currentRunId = null;
    this.lastNodeId = null;
  }


  startRun() {
    this.currentRunId = graphStorage.createRun();
    this.lastNodeId = null;
    console.log(`📊 Started graph tracking: ${this.currentRunId}`);
    return this.currentRunId;
  }

  trackStep(data) {
    if (!this.currentRunId) {
      throw new Error("No active run. Call startRun() first.");
    }

    const nodeId = graphStorage.addNode(this.currentRunId, {
      ...data,
      timestamp: new Date().toISOString()
    });

    // Create edge from previous step
    if (this.lastNodeId) {
      graphStorage.addEdge(this.currentRunId, {
        from: this.lastNodeId,
        to: nodeId,
        action: data.actionTaken
      });
    }

    this.lastNodeId = nodeId;
    console.log(`📊 Tracked step: ${data.actionTaken}`);
    return nodeId;
  }

  finishRun() {
    if (this.currentRunId) {
      graphStorage.finishRun(this.currentRunId);
      console.log(`📊 Finished graph tracking: ${this.currentRunId}`);
      this.currentRunId = null;
      this.lastNodeId = null;
    }
  }

  getCurrentRunId() {
    return this.currentRunId;
  }
}

export const graphTracker = new GraphTracker();