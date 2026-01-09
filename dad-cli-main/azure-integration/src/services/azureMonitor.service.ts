import { LogsQueryClient } from "@azure/monitor-query";
import { ClientSecretCredential } from "@azure/identity";
import { azureConfig } from "../config/azure";

const credential = new ClientSecretCredential(
  azureConfig.tenantId,
  azureConfig.clientId,
  azureConfig.clientSecret
);

const client = new LogsQueryClient(credential);

export async function queryLogs(kustoQuery: string) {
  try {
    const result: any = await client.queryWorkspace(
      azureConfig.monitor.workspaceId,
      kustoQuery,
      { duration: "PT1H" }
    );

    // Azure SDK typing workaround
    if (!result.tables || !result.tables.length) {
      return {
        count: 0,
        data: [],
        raw: result
      };
    }

    const table = result.tables[0];

    const formatted = table.rows.map((row: any[]) => {
      const obj: Record<string, any> = {};

      table.columns.forEach(
        (col: { name: string }, index: number) => {
          obj[col.name] = row[index];
        }
      );

      return obj;
    });

    return {
      count: formatted.length,
      data: formatted
    };

  } catch (error: any) {
    console.error("Azure Monitor Query Error:", error);

    return {
      error: true,
      message: error.message || "Failed to query Azure Monitor",
      details: error
    };
  }
}
