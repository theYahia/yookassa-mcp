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

  it("lists exactly 10 tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(10);
  });

  it("has all expected tool names", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "cancel_payment",
      "capture_payment",
      "create_payment",
      "create_receipt",
      "create_refund",
      "get_balance",
      "get_payment",
      "get_refund",
      "list_payments",
      "list_refunds",
    ]);
  });

  it("each tool has a description", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });
});
