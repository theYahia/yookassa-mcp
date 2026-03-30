#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[yookassa-mcp] Сервер запущен. 10 инструментов. Первый MCP для ЮKassa.");
}

main().catch((error) => {
  console.error("[yookassa-mcp] Ошибка запуска:", error);
  process.exit(1);
});
