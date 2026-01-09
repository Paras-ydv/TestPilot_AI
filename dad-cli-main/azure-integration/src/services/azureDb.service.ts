import { CosmosClient } from "@azure/cosmos";
import { azureConfig } from "../config/azure";
import crypto from "crypto";

const client = new CosmosClient({
  endpoint: azureConfig.cosmos.endpoint,
  key: azureConfig.cosmos.key
});

export async function insertItem(container: string, data: any) {
  const db = client.database(azureConfig.cosmos.dbName);
  const cont = db.container(container);

  const { resource } = await cont.items.create({
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString()
  });

  return resource;
}

export async function fetchItems(container: string) {
  const db = client.database(azureConfig.cosmos.dbName);
  const cont = db.container(container);

  const { resources } = await cont.items.readAll().fetchAll();
  return resources;
}
