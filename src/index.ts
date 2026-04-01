#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
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

async function startHttpServer(server: McpServer, port: number): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "yookassa-mcp", tools: 20 }));
      return;
    }

    if (req.url === "/mcp") {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.error(`[yookassa-mcp] HTTP server on port ${port}`);
    console.error(`[yookassa-mcp] MCP: http://localhost:${port}/mcp`);
    console.error(`[yookassa-mcp] Health: http://localhost:${port}/health`);
  });
}

async function main() {
  const server = createMcpServer();
  const httpPort = process.argv.includes("--http")
    ? parseInt(process.env.HTTP_PORT ?? "3000", 10)
    : process.env.HTTP_PORT
      ? parseInt(process.env.HTTP_PORT, 10)
      : null;

  if (httpPort) {
    await startHttpServer(server, httpPort);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[yookassa-mcp] Server started (stdio). 20 tools. Production-grade YooKassa MCP.");
  }
}

main().catch((error) => {
  console.error("[yookassa-mcp] Startup error:", error);
  process.exit(1);
});
