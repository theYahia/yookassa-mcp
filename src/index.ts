#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  createPaymentSchema, handleCreatePayment,
  getPaymentSchema, handleGetPayment,
  capturePaymentSchema, handleCapturePayment,
  cancelPaymentSchema, handleCancelPayment,
  listPaymentsSchema, handleListPayments,
  savePaymentMethodSchema, handleSavePaymentMethod,
  createRecurringPaymentSchema, handleCreateRecurringPayment,
  createSbpPaymentSchema, handleCreateSbpPayment,
  createSplitPaymentSchema, handleCreateSplitPayment,
} from "./tools/payments.js";
import {
  createRefundSchema, handleCreateRefund,
  getRefundSchema, handleGetRefund,
  listRefundsSchema, handleListRefunds,
} from "./tools/refunds.js";
import {
  createReceiptSchema, handleCreateReceipt,
  listReceiptsSchema, handleListReceipts,
} from "./tools/receipts.js";
import { handleGetBalance } from "./tools/balance.js";
import {
  createPayoutSchema, handleCreatePayout,
  getPayoutSchema, handleGetPayout,
} from "./tools/payouts.js";
import {
  createWebhookSchema, handleCreateWebhook,
  handleListWebhooks,
  deleteWebhookSchema, handleDeleteWebhook,
} from "./tools/webhooks.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "yookassa-mcp",
    version: "2.0.0",
  });

  // === Payments (9) ===

  server.tool(
    "create_payment",
    "Create a payment in YooKassa. Returns a payment URL. Supports one-step and two-step payments, receipts, and metadata.",
    createPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreatePayment(params) }],
    }),
  );

  server.tool(
    "get_payment",
    "Get payment details by ID. Returns status, amount, payment method, confirmation URL, and metadata.",
    getPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetPayment(params) }],
    }),
  );

  server.tool(
    "capture_payment",
    "Confirm a two-step payment (capture held funds). Optionally capture a partial amount.",
    capturePaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCapturePayment(params) }],
    }),
  );

  server.tool(
    "cancel_payment",
    "Cancel a payment. Works for pending and waiting_for_capture statuses.",
    cancelPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCancelPayment(params) }],
    }),
  );

  server.tool(
    "list_payments",
    "List payments with filters by status, date range, and pagination cursor.",
    listPaymentsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleListPayments(params) }],
    }),
  );

  server.tool(
    "save_payment_method",
    "Save a payment method for recurring charges. Creates a small payment to bind the card/wallet, then it can be used for recurring payments.",
    savePaymentMethodSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleSavePaymentMethod(params) }],
    }),
  );

  server.tool(
    "create_recurring_payment",
    "Charge a saved payment method (recurring payment). No user interaction needed.",
    createRecurringPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateRecurringPayment(params) }],
    }),
  );

  server.tool(
    "create_sbp_payment",
    "Create a payment via SBP (Russian fast payment system). Returns a deep-link for the payer's banking app.",
    createSbpPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateSbpPayment(params) }],
    }),
  );

  server.tool(
    "create_split_payment",
    "Create a split payment for marketplaces. Distributes funds among multiple recipients (partners).",
    createSplitPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateSplitPayment(params) }],
    }),
  );

  // === Refunds (3) ===

  server.tool(
    "create_refund",
    "Refund a payment (full or partial). Specify payment_id and amount.",
    createRefundSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateRefund(params) }],
    }),
  );

  server.tool(
    "get_refund",
    "Get refund details by ID. Returns status, amount, and payment reference.",
    getRefundSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetRefund(params) }],
    }),
  );

  server.tool(
    "list_refunds",
    "List refunds with optional filter by payment_id.",
    listRefundsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleListRefunds(params) }],
    }),
  );

  // === Receipts (2) ===

  server.tool(
    "create_receipt",
    "Create a fiscal receipt (54-FZ compliance). Supports payment and refund receipts with items, VAT codes, and customer contacts.",
    createReceiptSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateReceipt(params) }],
    }),
  );

  server.tool(
    "list_receipts",
    "List receipts with filters by payment_id or refund_id.",
    listReceiptsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleListReceipts(params) }],
    }),
  );

  // === Payouts (2) ===

  server.tool(
    "create_payout",
    "Create a payout to a bank card, YooMoney wallet, or SBP phone number.",
    createPayoutSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreatePayout(params) }],
    }),
  );

  server.tool(
    "get_payout",
    "Get payout details by ID. Returns status, amount, and destination.",
    getPayoutSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetPayout(params) }],
    }),
  );

  // === Webhooks (3) ===

  server.tool(
    "create_webhook",
    "Register a webhook URL for YooKassa events (payment.succeeded, refund.succeeded, etc.).",
    createWebhookSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateWebhook(params) }],
    }),
  );

  server.tool(
    "list_webhooks",
    "List all registered webhooks for this shop.",
    {},
    async () => ({
      content: [{ type: "text", text: await handleListWebhooks() }],
    }),
  );

  server.tool(
    "delete_webhook",
    "Delete a webhook by ID. Stops sending notifications for that webhook.",
    deleteWebhookSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleDeleteWebhook(params) }],
    }),
  );

  // === Account (1) ===

  server.tool(
    "get_shop_balance",
    "Get shop info: ID, status, test mode, fiscalization settings.",
    {},
    async () => ({
      content: [{ type: "text", text: await handleGetBalance() }],
    }),
  );

  return server;
}

/** Count the registered tools by introspecting a probe server (keeps /health honest). */
export async function countRegisteredTools(): Promise<number> {
  const probe = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "probe", version: "0.0.0" });
  await Promise.all([probe.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  await probe.close();
  return tools.length;
}

/** Constant-time Bearer-token check. */
function isAuthorized(req: IncomingMessage, expectedToken: string): boolean {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface HttpServerConfig {
  /** Shared secret required as a Bearer token on /mcp. */
  authToken: string;
  /** Host:port values accepted in the Host header (DNS-rebinding protection). */
  allowedHosts: string[];
  /** Browser Origins allowed for CORS (empty = reject all browser origins). */
  allowedOrigins: string[];
  /** Tool count reported by /health. */
  toolCount: number;
}

/**
 * Build the HTTP server (without listening) so it can be unit-tested.
 *
 * Security posture for a money-moving server:
 * - /mcp requires a Bearer token (constant-time compare) before anything else.
 * - Stateless transport: a fresh McpServer + transport per request, closed when
 *   the response ends (no connect()-per-request leak on a shared server).
 * - DNS-rebinding protection via allowedHosts/allowedOrigins on the transport.
 * - CORS never uses "*"; an Origin is echoed only if explicitly allow-listed.
 */
export function createHttpServer(config: HttpServerConfig): Server {
  return createServer(async (req, res) => {
    const origin = req.headers["origin"];
    if (typeof origin === "string" && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "yookassa-mcp", tools: config.toolCount }));
      return;
    }

    if (req.url === "/mcp") {
      if (req.method !== "POST") {
        // Stateless endpoint: no GET (SSE) / DELETE (session) support.
        res.writeHead(405, { "Content-Type": "application/json", "Allow": "POST" });
        res.end(JSON.stringify({ error: "Method Not Allowed (stateless MCP endpoint accepts POST only)" }));
        return;
      }
      if (!isAuthorized(req, config.authToken)) {
        res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const requestServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableDnsRebindingProtection: true,
        allowedHosts: config.allowedHosts,
        allowedOrigins: config.allowedOrigins,
      });
      res.on("close", () => {
        transport.close();
        requestServer.close();
      });
      await requestServer.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });
}

async function startHttpServer(port: number): Promise<void> {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    throw new Error(
      "HTTP transport requires MCP_AUTH_TOKEN — a strong shared secret sent as a Bearer token on /mcp. " +
      "Refusing to expose money-moving tools without authentication. Set MCP_AUTH_TOKEN and retry."
    );
  }

  const host = process.env.HTTP_HOST ?? "127.0.0.1";
  const allowedHosts = (process.env.MCP_ALLOWED_HOSTS ?? `127.0.0.1:${port},localhost:${port}`)
    .split(",").map((s) => s.trim()).filter(Boolean);
  const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const toolCount = await countRegisteredTools();

  const httpServer = createHttpServer({ authToken, allowedHosts, allowedOrigins, toolCount });

  httpServer.listen(port, host, () => {
    console.error(`[yookassa-mcp] HTTP server on ${host}:${port} (${toolCount} tools)`);
    console.error(`[yookassa-mcp] MCP: http://${host}:${port}/mcp (Bearer auth required)`);
    console.error(`[yookassa-mcp] Health: http://${host}:${port}/health`);
  });
}

async function main() {
  const httpPort = process.argv.includes("--http")
    ? parseInt(process.env.HTTP_PORT ?? "3000", 10)
    : process.env.HTTP_PORT
      ? parseInt(process.env.HTTP_PORT, 10)
      : null;

  if (httpPort) {
    await startHttpServer(httpPort);
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[yookassa-mcp] Server started (stdio). Production-grade YooKassa MCP.");
  }
}

main().catch((error) => {
  console.error("[yookassa-mcp] Startup error:", error);
  process.exit(1);
});
