import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { GraphNode, GraphEdge } from "../shared/graph-types.js";

interface GraphRun {
  runId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    startTime: string;
    endTime?: string;
    totalSteps: number;
    errorCount: number;
  };
}

class GraphStorage {
  private runs: Map<string, GraphRun> = new Map();
  private storagePath: string;

  constructor(storagePath: string = "./runs") {
    this.storagePath = storagePath;
    try {
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
    } catch (error) {
      console.warn("⚠️ Could not create storage directory:", error instanceof Error ? error.message : String(error));
    }
  }

  createRun(): string {
    const runId = `run-${Date.now()}-${uuidv4().slice(0, 8)}`;
    this.runs.set(runId, {
      runId,
      nodes: [],
      edges: [],
      metadata: {
        startTime: new Date().toISOString(),
        totalSteps: 0,
        errorCount: 0
      }
    });
    return runId;
  }

  addNode(runId: string, data: Omit<GraphNode, "id">): string {
    const run = this.runs.get(runId);
    if (!run) {
      console.warn(`⚠️ Run ${runId} not found, creating new run`);
      this.runs.set(runId, {
        runId,
        nodes: [],
        edges: [],
        metadata: {
          startTime: new Date().toISOString(),
          totalSteps: 0,
          errorCount: 0
        }
      });
    }

    const currentRun = this.runs.get(runId)!;
    const nodeId = uuidv4();
    const node: GraphNode = { id: nodeId, ...data };
    currentRun.nodes.push(node);
    currentRun.metadata.totalSteps++;
    if (data.status === "error") {
      currentRun.metadata.errorCount++;
    }

    return nodeId;
  }

  addEdge(runId: string, data: { from: string; to: string; action: string }): void {
    const run = this.runs.get(runId);
    if (!run) {
      console.warn(`⚠️ Run ${runId} not found for edge creation`);
      return;
    }
    run.edges.push(data);
  }

  finishRun(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) {
      console.warn(`⚠️ Run ${runId} not found for finish`);
      return;
    }

    run.metadata.endTime = new Date().toISOString();

    // Persist to file
    try {
      const filePath = path.join(this.storagePath, `${runId}-graph.json`);
      fs.writeFileSync(filePath, JSON.stringify(run, null, 2));
      console.log(`📊 Graph saved to ${filePath}`);
    } catch (error) {
      console.error("❌ Failed to save graph:", error instanceof Error ? error.message : String(error));
    }
  }

  getRun(runId: string): GraphRun | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): GraphRun[] {
    return Array.from(this.runs.values());
  }
}

export const graphStorage = new GraphStorage();
