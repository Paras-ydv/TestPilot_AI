import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { azureConfig } from "../config/azure.js";

const creds = new ApiKeyCredentials({
  inHeader: { "Ocp-Apim-Subscription-Key": azureConfig.vision.key }
});

const client = new ComputerVisionClient(
  creds,
  azureConfig.vision.endpoint
);

export async function analyzeImage(imageInput: string) {
  let imageUrl: string;
  
  // Handle data URL (base64) format
  if (imageInput.startsWith('data:image/')) {
    // For data URLs, we need to upload to a temporary location or use a different Azure Vision method
    // For now, we'll extract the base64 and use the analyze image from stream method
    const base64Data = imageInput.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    return client.analyzeImageInStream(imageBuffer, {
      visualFeatures: [
        "Description",
        "Tags", 
        "Objects"
      ]
    });
  } else {
    // Handle regular URL
    imageUrl = imageInput.trim();
    console.log("IMAGE URL =>", imageUrl);
    
    return client.analyzeImage(imageUrl, {
      visualFeatures: [
        "Description",
        "Tags",
        "Objects"
      ]
    });
  }
}
