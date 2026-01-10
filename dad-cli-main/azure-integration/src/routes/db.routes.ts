import { FastifyInstance } from "fastify";
import { insertItem, fetchItems, getTestRuns, getTestSteps, insertTestRun, insertTestStep, insertAnomaly, updateTestRun } from "../services/azureDb.service.js";
import { apiKeyAuth } from "../utils/auth.js";

export async function dbRoutes(app: FastifyInstance) {

  // 🔐 protect all DB routes
  app.addHook("preHandler", apiKeyAuth);

  app.post("/insert", async (req: any) => {
    return insertItem("logs", req.body);
  });

  app.get("/all", async () => {
    return fetchItems("logs");
  });

  app.get("/test-runs", async () => {
    return getTestRuns();
  });

  app.get("/test-steps/:runId", async (req: any) => {
    return getTestSteps(req.params.runId);
  });

  app.post("/test-runs", async (req: any) => {
    return insertTestRun(req.body);
  });

  app.post("/test-steps", async (req: any) => {
    return insertTestStep(req.body);
  });

  app.post("/anomalies", async (req: any) => {
    return insertAnomaly(req.body);
  });

  app.put("/test-runs/:runId", async (req: any) => {
    return updateTestRun(req.params.runId, req.body);
  });
}
