import { FastifyInstance } from "fastify";
import { analyzeImage } from "../services/azureVision.service";
import { apiKeyAuth } from "../utils/auth";

export async function visionRoutes(app: FastifyInstance) {

  // 🔐 protect all Vision routes
  app.addHook("preHandler", apiKeyAuth);

  app.post("/analyze", async (req: any) => {
    const { url } = req.body;

    if (!url) {
      return { error: "Image URL required" };
    }

    return analyzeImage(url);
  });
}
