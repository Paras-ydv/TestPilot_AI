import { FastifyInstance } from "fastify";
import { queryLogs } from "../services/azureMonitor.service.js";
import { apiKeyAuth } from "../utils/auth.js";

export async function monitorRoutes(app: FastifyInstance) {

  // 🔐 protect all Monitor routes
  app.addHook("preHandler", apiKeyAuth);

  app.post("/query", async (req: any) => {
    const { query } = req.body;

    if (!query) {
      return { error: "Kusto query required" };
    }

    return queryLogs(query);
  });
}
