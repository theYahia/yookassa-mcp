import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

// --- Schemas ---

export const createPaymentSchema = z.object({
  amount: z.number().positive().describe("Сумма платежа в рублях"),
  currency: z.string().default("RUB").describe("Валюта (по умолчанию RUB)"),
  description: z.string().max(128).describe("Описание платежа (макс 128 символов)"),
  capture: z.boolean().default(true).describe("true = одностадийный, false = холдирование"),
  return_url: z.string().url().optional().describe("URL для возврата после оплаты"),
  payment_method_type: z.enum([
    "bank_card", "sbp", "yoo_money", "sberbank", "tinkoff_bank",
    "mobile_balance", "cash", "installments"
  ]).optional().describe("Способ оплаты"),
});

export const getPaymentSchema = z.object({
  payment_id: z.string().describe("ID платежа (например pay_xxx)"),
});

export const capturePaymentSchema = z.object({
  payment_id: z.string().describe("ID платежа для подтверждения"),
  amount: z.number().positive().optional().describe("Сумма для частичного подтверждения (опционально)"),
});

export const cancelPaymentSchema = z.object({
  payment_id: z.string().describe("ID платежа для отмены"),
});

export const listPaymentsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10).describe("Количество (1-100, по умолчанию 10)"),
  status: z.enum(["pending", "waiting_for_capture", "succeeded", "canceled"]).optional().describe("Фильтр по статусу"),
  created_at_gte: z.string().optional().describe("От даты (ISO datetime)"),
  created_at_lte: z.string().optional().describe("До даты (ISO datetime)"),
});

// --- Handlers ---

export async function handleCreatePayment(params: z.infer<typeof createPaymentSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: params.capture,
    confirmation: params.return_url
      ? { type: "redirect", return_url: params.return_url }
      : { type: "redirect", return_url: "https://example.com/return" },
  };

  if (params.payment_method_type) {
    body.payment_method_data = { type: params.payment_method_type };
  }

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}

export async function handleGetPayment(params: z.infer<typeof getPaymentSchema>): Promise<string> {
  const result = await getClient().get(`/payments/${params.payment_id}`);
  return JSON.stringify(result, null, 2);
}

export async function handleCapturePayment(params: z.infer<typeof capturePaymentSchema>): Promise<string> {
  const body = params.amount ? { amount: formatAmount(params.amount) } : {};
  const result = await getClient().post(`/payments/${params.payment_id}/capture`, body);
  return JSON.stringify(result, null, 2);
}

export async function handleCancelPayment(params: z.infer<typeof cancelPaymentSchema>): Promise<string> {
  const result = await getClient().post(`/payments/${params.payment_id}/cancel`, {});
  return JSON.stringify(result, null, 2);
}

export async function handleListPayments(params: z.infer<typeof listPaymentsSchema>): Promise<string> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.created_at_gte) query.set("created_at.gte", params.created_at_gte);
  if (params.created_at_lte) query.set("created_at.lte", params.created_at_lte);

  const result = await getClient().get(`/payments?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}
