import { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../utils/auth.js";
import { getGraph, listRuns, deleteRun } from "../services/graph.services.js";
import fs from "fs";
import path from "path";

export async function graphRoutes(app: FastifyInstance) {

  // -------------------------
  // PUBLIC: SERVE SCREENSHOTS
  // -------------------------
  app.get("/screenshots/:filename", async (req: any, reply) => {
    try {
      const { filename } = req.params;
      // Look in screenshots directory relative to server root
      const screenshotPath = path.resolve("../screenshots", filename);

      if (!fs.existsSync(screenshotPath)) {
        reply.code(404);
        return { error: "Screenshot not found" };
      }

      const stream = fs.createReadStream(screenshotPath);
      reply.type("image/png");
      return reply.send(stream);
    } catch (err) {
      reply.code(500);
      return { error: "Failed to serve screenshot" };
    }
  });

  // -------------------------
  // PROTECTED ROUTES
  // -------------------------
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", apiKeyAuth);

    // FETCH GRAPH
    protectedApp.get("/run/:runId", async (req: any) => {
      const { runId } = req.params;
      return getGraph(runId);
    });

    // LIST RUNS
    protectedApp.get("/runs", async (req, reply) => {
      try {
        return await listRuns();
      } catch (err) {
        reply.code(500);
        return { error: "Failed to list runs" };
      }
    });

    // DELETE RUN
    protectedApp.delete("/run/:runId", async (req: any, reply) => {
      try {
        const { runId } = req.params;
        await deleteRun(runId);
        return { message: "Run deleted successfully" };
      } catch (err) {
        reply.code(500);
        return { error: "Failed to delete run" };
      }
    });
  });
}
