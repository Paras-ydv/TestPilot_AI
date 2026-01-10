import { CosmosClient } from "@azure/cosmos";
import { azureConfig } from "../config/azure.js";

const client = new CosmosClient({
  endpoint: azureConfig.cosmos.endpoint,
  key: azureConfig.cosmos.key
});

async function setupDatabase() {
  try {
    console.log("🔧 Setting up CosmosDB containers...");
    
    const database = client.database(azureConfig.cosmos.dbName);
    
    // Create containers with partition keys
    const containers = [
      { id: "test_runs", partitionKey: "/runId" },
      { id: "test_steps", partitionKey: "/runId" },
      { id: "anomalies", partitionKey: "/runId" }
    ];
    
    for (const container of containers) {
      try {
        await database.containers.createIfNotExists({
          id: container.id,
          partitionKey: container.partitionKey
        });
        console.log(`✅ Container '${container.id}' ready`);
      } catch (error) {
        console.log(`⚠️ Container '${container.id}' already exists or error:`, error);
      }
    }
    
    console.log("🎉 Database setup complete!");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();