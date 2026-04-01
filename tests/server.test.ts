import { describe, it, expect, beforeAll } from "vitest";
import { createMcpServer } from "../src/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("MCP Server smoke test", () => {
  let client: Client;

  beforeAll(async () => {
    process.env.YOOKASSA_SHOP_ID = "test_shop";
    process.env.YOOKASSA_SECRET_KEY = "test_key";

    const server = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  it("lists exactly 20 tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(20);
  });

  it("has all expected tool names", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "cancel_payment",
      "capture_payment",
      "create_payment",
      "create_payout",
      "create_receipt",
      "create_recurring_payment",
      "create_refund",
      "create_sbp_payment",
      "create_split_payment",
      "create_webhook",
      "delete_webhook",
      "get_payment",
      "get_payout",
      "get_refund",
      "get_shop_balance",
      "list_payments",
      "list_receipts",
      "list_refunds",
      "list_webhooks",
      "save_payment_method",
    ]);
  });

  it("each tool has a description", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });
});
