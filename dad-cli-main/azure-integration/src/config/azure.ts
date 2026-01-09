import "dotenv/config";

export const azureConfig = {
  tenantId: process.env.AZURE_TENANT_ID!,
  clientId: process.env.AZURE_CLIENT_ID!,
  clientSecret: process.env.AZURE_CLIENT_SECRET!,

  cosmos: {
    endpoint: process.env.AZURE_COSMOS_ENDPOINT!,
    key: process.env.AZURE_COSMOS_KEY!,
    dbName: process.env.AZURE_COSMOS_DB!,
  },

  vision: {
    endpoint: process.env.AZURE_VISION_ENDPOINT!,
    key: process.env.AZURE_VISION_KEY!,
  },

  monitor: {
    workspaceId: process.env.AZURE_LOG_WORKSPACE!,
  }
};
