import { z } from "zod";
import { getClient, formatAmount, formatKopecks, moneyAmount, currencyCode, toKopecks } from "../client.js";
import { buildReceiptItems } from "./receipts.js";

// --- Schemas ---

export const createPaymentSchema = z.object({
  amount: moneyAmount.describe("Сумма платежа в рублях (строка '5000.00' — точно, или число)"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  description: z.string().max(128).describe("Описание платежа (макс 128 символов)"),
  capture: z.boolean().default(true).describe("true = одностадийный, false = холдирование"),
  confirmation_type: z.enum(["redirect", "embedded", "qr"]).default("redirect").describe("Тип подтверждения оплаты: redirect (нужен return_url), embedded (виджет) или qr"),
  return_url: z.string().url().optional().describe("URL возврата покупателя после оплаты — ОБЯЗАТЕЛЕН при confirmation_type=redirect"),
  payment_method_type: z.enum([
    "bank_card", "sbp", "yoo_money", "sberbank", "tinkoff_bank",
    "mobile_balance", "cash", "installments"
  ]).optional().describe("Способ оплаты"),
  metadata: z.record(z.string()).optional().describe("Произвольные метаданные (ключ-значение)"),
  receipt_email: z.string().email().optional().describe("Email покупателя для чека"),
  receipt_tax_system_code: z.number().int().min(1).max(6).optional().describe("Система налогообложения для чека, тег 1055 (только если несколько СНО / ФФД 1.2)"),
  receipt_items: z.array(z.object({
    description: z.string().describe("Название товара/услуги"),
    quantity: z.number().positive().describe("Количество"),
    amount: moneyAmount.describe("Цена за единицу"),
    vat_code: z.number().int().min(1).max(6).describe("Код НДС: 1=без, 2=0%, 3=10%, 4=20%, 5=10/110, 6=20/120"),
    payment_subject: z.string().optional().describe("Признак предмета расчёта, тег 1212 (по умолчанию 'commodity')"),
    payment_mode: z.string().optional().describe("Признак способа расчёта, тег 1214 (по умолчанию 'full_payment')"),
    measure: z.string().optional().describe("Мера количества, тег 2108 (по умолчанию 'piece'; нужна для ФФД 1.2)"),
  })).optional().describe("Товары для чека 54-ФЗ (если нужен чек при создании платежа)"),
});

export const getPaymentSchema = z.object({
  payment_id: z.string().describe("ID платежа (например pay_xxx)"),
});

export const capturePaymentSchema = z.object({
  payment_id: z.string().describe("ID платежа для подтверждения"),
  amount: moneyAmount.optional().describe("Сумма для частичного подтверждения (опционально; не больше суммы холдирования, та же валюта). Превышение отклонит ЮKassa"),
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
  amount: moneyAmount.describe("Сумма для привязки (минимум 1 рубль, спишется и вернётся)"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  description: z.string().default("Привязка карты").describe("Описание"),
  return_url: z.string().url().describe("URL возврата после привязки"),
  payment_method_type: z.enum(["bank_card", "yoo_money", "sberbank"]).default("bank_card").describe("Тип метода оплаты"),
});

export const createRecurringPaymentSchema = z.object({
  payment_method_id: z.string().describe("ID сохранённого метода оплаты (из payment_method.id)"),
  amount: moneyAmount.describe("Сумма рекуррентного платежа"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  description: z.string().max(128).describe("Описание рекуррентного платежа"),
});

export const createSbpPaymentSchema = z.object({
  amount: moneyAmount.describe("Сумма платежа через СБП"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  description: z.string().max(128).describe("Описание платежа"),
  confirmation_type: z.enum(["redirect", "embedded", "qr"]).default("redirect").describe("Тип подтверждения: redirect (нужен return_url), embedded или qr"),
  return_url: z.string().url().optional().describe("URL возврата — ОБЯЗАТЕЛЕН при confirmation_type=redirect"),
});

export const createSplitPaymentSchema = z.object({
  amount: moneyAmount.describe("Общая сумма платежа"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  description: z.string().max(128).describe("Описание платежа"),
  confirmation_type: z.enum(["redirect", "embedded", "qr"]).default("redirect").describe("Тип подтверждения: redirect (нужен return_url), embedded или qr"),
  return_url: z.string().url().optional().describe("URL возврата — ОБЯЗАТЕЛЕН при confirmation_type=redirect"),
  transfers: z.array(z.object({
    account_id: z.string().describe("ID получателя (shopId партнёра, подключённого к платформе)"),
    amount: moneyAmount.describe("Сумма для этого получателя"),
    platform_fee_amount: moneyAmount.optional().describe("Комиссия платформы, удерживаемая с этого перевода (тег API platform_fee_amount)"),
    description: z.string().optional().describe("Описание перевода"),
    metadata: z.record(z.string()).optional().describe("Метаданные перевода"),
  })).min(1).describe("Массив получателей (splits). Сумма переводов должна равняться amount. Требует продукт «Сплитование платежей»"),
});

// --- Handlers ---

/**
 * Build a confirmation object. For redirect, return_url is required (no placeholder is
 * invented — a bogus return_url would redirect the real payer to a dead page after paying).
 * embedded/qr need no return_url.
 */
function buildConfirmation(type: "redirect" | "embedded" | "qr", returnUrl?: string): Record<string, unknown> {
  // embedded/qr need no return_url; everything else (incl. the default) is redirect.
  if (type === "embedded" || type === "qr") {
    return { type };
  }
  if (!returnUrl) {
    throw new Error(
      "return_url обязателен при confirmation_type=redirect (URL, на который ЮKassa вернёт покупателя после оплаты). " +
      "Передайте реальный return_url или выберите confirmation_type=embedded/qr."
    );
  }
  return { type: "redirect", return_url: returnUrl };
}

export async function handleCreatePayment(params: z.infer<typeof createPaymentSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: params.capture,
    confirmation: buildConfirmation(params.confirmation_type, params.return_url),
  };

  if (params.payment_method_type) {
    body.payment_method_data = { type: params.payment_method_type };
  }

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  if (params.receipt_email && params.receipt_items) {
    const receipt: Record<string, unknown> = {
      customer: { email: params.receipt_email },
      items: buildReceiptItems(params.receipt_items, params.currency),
    };
    if (params.receipt_tax_system_code !== undefined) receipt.tax_system_code = params.receipt_tax_system_code;
    body.receipt = receipt;
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
    confirmation: buildConfirmation(params.confirmation_type, params.return_url),
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}

export async function handleCreateSplitPayment(params: z.infer<typeof createSplitPaymentSchema>): Promise<string> {
  // The buyer is charged `amount`, distributed across transfers — their sum must equal it.
  const totalK = toKopecks(params.amount);
  const sumK = params.transfers.reduce((s, t) => s + toKopecks(t.amount), 0);
  if (sumK !== totalK) {
    throw new Error(
      `Сумма переводов (${formatKopecks(sumK).value}) должна равняться общей сумме платежа (${formatKopecks(totalK).value}).`
    );
  }

  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    description: params.description,
    capture: true,
    confirmation: buildConfirmation(params.confirmation_type, params.return_url),
    transfers: params.transfers.map(t => ({
      account_id: t.account_id,
      amount: formatAmount(t.amount, params.currency),
      ...(t.platform_fee_amount !== undefined ? { platform_fee_amount: formatAmount(t.platform_fee_amount, params.currency) } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.metadata ? { metadata: t.metadata } : {}),
    })),
  };

  const result = await getClient().post("/payments", body);
  return JSON.stringify(result, null, 2);
}
