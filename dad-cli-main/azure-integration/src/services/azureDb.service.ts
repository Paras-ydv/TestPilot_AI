import { CosmosClient } from "@azure/cosmos";
import { azureConfig } from "../config/azure.js";
import crypto from "crypto";

interface TestRun {
  id: string;
  runId: string;
  targetUrl: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  anomaliesCount: number;
}

interface TestStep {
  id: string;
  runId: string;
  stepIndex: number;
  actionId: string;
  actionType: string;
  parameters: Record<string, any>;
  timestamp: string;
  status: "success" | "failed" | "skipped";
  screenshotPath: string;
  networkCalls: number;
  consoleErrors: string[];
  stateId?: string;
  reasoning?: string;
}

interface Anomaly {
  id: string;
  runId: string;
  stepIndex: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  description: string;
  evidence: Record<string, any>;
  timestamp: string;
}

const client = new CosmosClient({
  endpoint: azureConfig.cosmos.endpoint,
  key: azureConfig.cosmos.key
});

function getDatabase() {
  if (!azureConfig.cosmos.endpoint || !azureConfig.cosmos.key || !azureConfig.cosmos.dbName) {
    throw new Error("Azure Cosmos DB configuration missing");
  }
  return client.database(azureConfig.cosmos.dbName);
}

export async function insertItem(container: string, data: any) {
  try {
    const database = getDatabase();
    const containerRef = database.container(container);

    const { resource } = await containerRef.items.create({
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    });

    return resource;
  } catch (error) {
    console.error("❌ Cosmos DB insert failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database insert operation failed");
  }
}

export async function insertTestRun(runData: Omit<TestRun, 'id'>) {
  try {
    const database = getDatabase();
    const containerRef = database.container("test_runs");

    const { resource } = await containerRef.items.create({
      id: crypto.randomUUID(),
      ...runData,
      createdAt: new Date().toISOString()
    });

    return resource;
  } catch (error) {
    console.error("❌ CosmosDB test run insert failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database test run insert failed");
  }
}

export async function updateTestRun(runId: string, updates: Partial<TestRun>) {
  try {
    const database = getDatabase();
    const containerRef = database.container("test_runs");

    const { resources } = await containerRef.items.query({
      query: "SELECT * FROM c WHERE c.runId = @runId",
      parameters: [{ name: "@runId", value: runId }]
    }).fetchAll();

    if (resources.length > 0) {
      const item = resources[0];
      const { resource } = await containerRef.item(item.id, runId).replace({
        ...item,
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return resource;
    }
    return null;
  } catch (error) {
    console.error("❌ CosmosDB test run update failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database test run update failed");
  }
}

export async function insertTestStep(stepData: Omit<TestStep, 'id'>) {
  try {
    const database = getDatabase();
    const containerRef = database.container("test_steps");

    const { resource } = await containerRef.items.create({
      id: crypto.randomUUID(),
      ...stepData
    });

    return resource;
  } catch (error) {
    console.error("❌ CosmosDB test step insert failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database test step insert failed");
  }
}

export async function insertAnomaly(anomalyData: Omit<Anomaly, 'id'>) {
  try {
    const database = getDatabase();
    const containerRef = database.container("anomalies");

    const { resource } = await containerRef.items.create({
      id: crypto.randomUUID(),
      ...anomalyData
    });

    return resource;
  } catch (error) {
    console.error("❌ CosmosDB anomaly insert failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database anomaly insert failed");
  }
}
export async function getTestRuns() {
  try {
    const database = getDatabase();
    const containerRef = database.container("test_runs");
    const { resources } = await containerRef.items.readAll().fetchAll();
    return resources;
  } catch (error) {
    console.error("❌ CosmosDB test runs fetch failed:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getTestSteps(runId: string) {
  try {
    const database = getDatabase();
    const containerRef = database.container("test_steps");
    const { resources } = await containerRef.items.query({
      query: "SELECT * FROM c WHERE c.runId = @runId ORDER BY c.stepIndex",
      parameters: [{ name: "@runId", value: runId }]
    }).fetchAll();
    return resources;
  } catch (error) {
    console.error("❌ CosmosDB test steps fetch failed:", error instanceof Error ? error.message : String(error));
    return [];
  }
}
export async function fetchItems(container: string) {
  try {
    const database = getDatabase();
    const containerRef = database.container(container);
    const { resources } = await containerRef.items.readAll().fetchAll();
    return resources;
  } catch (error) {
    console.error("❌ Cosmos DB fetch failed:", error instanceof Error ? error.message : String(error));
    throw new Error("Database fetch operation failed");
  }
}

export async function deleteRunData(runId: string) {
  try {
    const database = getDatabase();
    console.log(`🗑️ Initiating deletion for runId: ${runId}`);

    // 1. Delete from test_runs
    const runContainer = database.container("test_runs");
    const { resources: runs } = await runContainer.items.query({
      query: "SELECT * FROM c WHERE c.runId = @runId",
      parameters: [{ name: "@runId", value: runId }]
    }).fetchAll();

    for (const run of runs) {
      // Pass the partition key (runId) as the second argument
      await runContainer.item(run.id, runId).delete();
    }

    // 2. Delete from test_steps
    const stepContainer = database.container("test_steps");
    const { resources: steps } = await stepContainer.items.query({
      query: "SELECT * FROM c WHERE c.runId = @runId",
      parameters: [{ name: "@runId", value: runId }]
    }).fetchAll();

    for (const step of steps) {
      await stepContainer.item(step.id, runId).delete();
    }

    // 3. Delete from anomalies
    const anomalyContainer = database.container("anomalies");
    const { resources: anomalies } = await anomalyContainer.items.query({
      query: "SELECT * FROM c WHERE c.runId = @runId",
      parameters: [{ name: "@runId", value: runId }]
    }).fetchAll();

    for (const anomaly of anomalies) {
      await anomalyContainer.item(anomaly.id, runId).delete();
    }

    console.log(`✅ Successfully deleted data for run: ${runId} (${runs.length} runs, ${steps.length} steps, ${anomalies.length} anomalies)`);
    return true;
  } catch (error: any) {
    console.error("❌ CosmosDB deletion failed:", error?.message || String(error));
    if (error?.body) {
      console.error("Error body:", JSON.stringify(error.body));
    }
    throw error;
  }
}