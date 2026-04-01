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
  metadata: z.record(z.string()).optional().describe("Произвольные метаданные (ключ-значение)"),
  receipt_email: z.string().email().optional().describe("Email покупателя для чека"),
  receipt_items: z.array(z.object({
    description: z.string().describe("Название товара/услуги"),
    quantity: z.number().positive().describe("Количество"),
    amount: z.number().positive().describe("Цена за единицу"),
    vat_code: z.number().int().min(1).max(6).describe("Код НДС: 1=без, 2=0%, 3=10%, 4=20%, 5=10/110, 6=20/120"),
  })).optional().describe("Товары для чека 54-ФЗ (если нужен чек при создании платежа)"),
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
  cursor: z.string().optional().describe("Курсор для пагинации (из next_cursor предыдущего ответа)"),
});

export const savePaymentMethodSchema = z.object({
  amount: z.number().positive().describe("Сумма для привязки (минимум 1 рубль, спишется и вернётся)"),
  currency: z.string().default("RUB").describe("Валюта"),
  description: z.string().default("Привязка карты").describe("Описание"),
  return_url: z.string().url().describe("URL возврата после привязки"),
  payment_method_type: z.enum(["bank_card", "yoo_money", "sberbank"]).default("bank_card").describe("Тип метода оплаты"),
});

export const createRecurringPaymentSchema = z.object({
  payment_method_id: z.string().describe("ID сохранённого метода оплаты (из payment_method.id)"),
  amount: z.number().positive().describe("Сумма рекуррентного платежа"),
  currency: z.string().default("RUB").describe("Валюта"),
  description: z.string().max(128).describe("Описание рекуррентного платежа"),
});

export const createSbpPaymentSchema = z.object({
  amount: z.number().positive().describe("Сумма платежа через СБП"),
  currency: z.string().default("RUB").describe("Валюта"),
  description: z.string().max(128).describe("Описание платежа"),
  return_url: z.string().url().optional().describe("URL возврата"),
});

export const createSplitPaymentSchema = z.object({
  amount: z.number().positive().describe("Общая сумма платежа"),
  currency: z.string().default("RUB").describe("Валюта"),
  description: z.string().max(128).describe("Описание платежа"),
  return_url: z.string().url().optional().describe("URL возврата"),
  transfers: z.array(z.object({
    account_id: z.string().describe("ID получателя (shopId партнёра)"),
    amount: z.number().positive().describe("Сумма для этого получателя"),
    description: z.string().optional().describe("Описание перевода"),
  })).min(1).describe("Массив получателей (splits) для маркетплейса"),
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

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  if (params.receipt_email && params.receipt_items) {
    body.receipt = {
      customer: { email: params.receipt_email },
      items: params.receipt_items.map(item => ({
        description: item.description,
        quantity: String(item.quantity),
        amount: formatAmount(item.amount, params.currency),
        vat_code: item.vat_code,
      })),
    };
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
  if (params.cursor) query.set("cursor", params.cursor);

  const result = await getClient().get(`/payments?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}

export async function handleSavePaymentMethod(params: z.infer<typeof savePaymentMethodSchema>): Promise<string> {
  const body = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: true,
    payment_method_data: { type: params.payment_method_type },
    save_payment_method: true,
    confirmation: { type: "redirect", return_url: params.return_url },
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}

export async function handleCreateRecurringPayment(params: z.infer<typeof createRecurringPaymentSchema>): Promise<string> {
  const body = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: true,
    payment_method_id: params.payment_method_id,
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}

export async function handleCreateSbpPayment(params: z.infer<typeof createSbpPaymentSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: true,
    payment_method_data: { type: "sbp" },
    confirmation: {
      type: "redirect",
      return_url: params.return_url ?? "https://example.com/return",
    },
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}

export async function handleCreateSplitPayment(params: z.infer<typeof createSplitPaymentSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: params.return_url ?? "https://example.com/return",
    },
    transfers: params.transfers.map(t => ({
      account_id: t.account_id,
      amount: formatAmount(t.amount, params.currency),
      ...(t.description ? { description: t.description } : {}),
    })),
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}
