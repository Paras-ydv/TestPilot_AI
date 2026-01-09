import { FastifyInstance } from "fastify";
import { insertItem, fetchItems } from "../services/azureDb.service";
import { apiKeyAuth } from "../utils/auth";

export async function dbRoutes(app: FastifyInstance) {

  // 🔐 protect all DB routes
  app.addHook("preHandler", apiKeyAuth);

  app.post("/insert", async (req) => {
    return insertItem("logs", req.body);
  });

  app.get("/all", async () => {
    return fetchItems("logs");
  });
}
