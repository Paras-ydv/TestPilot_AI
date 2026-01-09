import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { azureConfig } from "../config/azure";

const creds = new ApiKeyCredentials({
  inHeader: { "Ocp-Apim-Subscription-Key": azureConfig.vision.key }
});

const client = new ComputerVisionClient(
  creds,
  azureConfig.vision.endpoint
);

export async function analyzeImage(rawUrl: string) {

  // 🔧 sanitize URL (THIS fixes your bug)
  const cleanUrl = rawUrl.trim();

  console.log("IMAGE URL =>", cleanUrl);

  return client.analyzeImage(cleanUrl, {
    visualFeatures: [
      "Description",
      "Tags",
      "Objects"
    ]
  });
}
