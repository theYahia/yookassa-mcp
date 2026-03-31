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
} from "./tools/payments.js";
import {
  createRefundSchema, handleCreateRefund,
  getRefundSchema, handleGetRefund,
  listRefundsSchema, handleListRefunds,
} from "./tools/refunds.js";
import { createReceiptSchema, handleCreateReceipt } from "./tools/receipts.js";
import { handleGetBalance } from "./tools/balance.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "yookassa-mcp",
    version: "1.0.0",
  });

  // Payments
  server.tool(
    "create_payment",
    "Создать платёж в ЮKassa. Возвращает ссылку на оплату.",
    createPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreatePayment(params) }],
    }),
  );

  server.tool(
    "get_payment",
    "Получить информацию о платеже по ID.",
    getPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetPayment(params) }],
    }),
  );

  server.tool(
    "capture_payment",
    "Подтвердить платёж (для двухстадийных). Можно подтвердить частичную сумму.",
    capturePaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCapturePayment(params) }],
    }),
  );

  server.tool(
    "cancel_payment",
    "Отменить платёж.",
    cancelPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCancelPayment(params) }],
    }),
  );

  server.tool(
    "list_payments",
    "Список платежей с фильтрами по статусу и дате.",
    listPaymentsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleListPayments(params) }],
    }),
  );

  // Refunds
  server.tool(
    "create_refund",
    "Сделать возврат по платежу (полный или частичный).",
    createRefundSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateRefund(params) }],
    }),
  );

  server.tool(
    "get_refund",
    "Получить информацию о возврате по ID.",
    getRefundSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetRefund(params) }],
    }),
  );

  server.tool(
    "list_refunds",
    "Список возвратов с фильтром по платежу.",
    listRefundsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleListRefunds(params) }],
    }),
  );

  // Receipts
  server.tool(
    "create_receipt",
    "Создать кассовый чек 54-ФЗ для платежа или возврата.",
    createReceiptSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateReceipt(params) }],
    }),
  );

  // Balance
  server.tool(
    "get_balance",
    "Информация о магазине: ID, статус, тестовый режим, фискализация.",
    {},
    async () => ({
      content: [{ type: "text", text: await handleGetBalance() }],
    }),
  );

  return server;
}

async function startHttpServer(server: McpServer, port: number): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "yookassa-mcp", tools: 10 }));
      return;
    }

    // MCP endpoint
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
    console.error(`[yookassa-mcp] HTTP сервер запущен на порту ${port}`);
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
    console.error("[yookassa-mcp] Сервер запущен (stdio). 10 инструментов. Первый MCP для ЮKassa.");
  }
}

main().catch((error) => {
  console.error("[yookassa-mcp] Ошибка запуска:", error);
  process.exit(1);
});
