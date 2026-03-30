import { YooKassaClient } from "../client.js";

const client = new YooKassaClient();

export async function handleGetBalance(): Promise<string> {
  const result = await client.get("/me");
  return JSON.stringify(result, null, 2);
}
