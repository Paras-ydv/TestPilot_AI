import { FastifyInstance } from "fastify";
import { analyzeImage } from "../services/azureVision.service.js";
import { apiKeyAuth } from "../utils/auth.js";
import fs from "fs";
import path from "path";

export async function visionRoutes(app: FastifyInstance) {
  // Protect all Vision routes
  app.addHook("preHandler", apiKeyAuth);

  app.post("/analyze", async (request: any) => {
    try {
      const { url } = request.body;

      if (!url) {
        return { error: "Image URL required" };
      }

      const result = await analyzeImage(url);
      return {
        caption: result.description?.captions?.[0]?.text,
        tags: result.tags?.map((t: any) => t.name),
        objects: result.objects?.map((o: any) => o.object)
      };
    } catch (error) {
      return { error: "Failed to analyze image", details: error instanceof Error ? error.message : String(error) };
    }
  });

  app.post("/analyze-local", async (request: any) => {
    try {
      const { screenshotPath } = request.body;

      if (!screenshotPath) {
        return { error: "Screenshot path required" };
      }

      // Validate file exists and is in screenshots directory
      const filename = path.basename(screenshotPath);
      const fullPath = path.resolve("../screenshots", filename);

      if (!fs.existsSync(fullPath)) {
        return { error: `Invalid screenshot path: ${filename}` };
      }

      // Convert local file to data URL for Azure Vision
      const imageBuffer = fs.readFileSync(fullPath);
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;

      const result = await analyzeImage(dataUrl);
      return {
        caption: result.description?.captions?.[0]?.text,
        tags: result.tags?.map((t: any) => t.name),
        objects: result.objects?.map((o: any) => o.object)
      };
    } catch (error) {
      return { error: "Failed to analyze local image", details: error instanceof Error ? error.message : String(error) };
    }
  });
}
