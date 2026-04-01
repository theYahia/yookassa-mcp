import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

export const createReceiptSchema = z.object({
  type: z.enum(["payment", "refund"]).describe("Тип чека"),
  payment_id: z.string().optional().describe("ID платежа (обязателен для type=payment)"),
  refund_id: z.string().optional().describe("ID возврата (обязателен для type=refund)"),
  customer_email: z.string().email().optional().describe("Email покупателя для чека"),
  customer_phone: z.string().optional().describe("Телефон покупателя (если нет email)"),
  items: z.array(z.object({
    description: z.string().describe("Название товара/услуги"),
    quantity: z.number().positive().describe("Количество"),
    amount: z.number().positive().describe("Цена за единицу в рублях"),
    vat_code: z.number().int().min(1).max(6).describe(
      "Код НДС: 1=без НДС, 2=0%, 3=10%, 4=20%, 5=расчётная 10/110, 6=расчётная 20/120"
    ),
  })).min(1).describe("Товары/услуги в чеке"),
  settlement_id: z.string().optional().describe("ID расчёта (для связки)"),
});

export const listReceiptsSchema = z.object({
  payment_id: z.string().optional().describe("Фильтр по ID платежа"),
  refund_id: z.string().optional().describe("Фильтр по ID возврата"),
  limit: z.number().int().min(1).max(100).default(10).describe("Количество (1-100)"),
  cursor: z.string().optional().describe("Курсор пагинации"),
});

export async function handleCreateReceipt(params: z.infer<typeof createReceiptSchema>): Promise<string> {
  const customer: Record<string, string> = {};
  if (params.customer_email) customer.email = params.customer_email;
  if (params.customer_phone) customer.phone = params.customer_phone;

  const body: Record<string, unknown> = {
    type: params.type,
    customer,
    items: params.items.map(item => ({
      description: item.description,
      quantity: String(item.quantity),
      amount: formatAmount(item.amount),
      vat_code: item.vat_code,
    })),
  };

  if (params.payment_id) body.payment_id = params.payment_id;
  if (params.refund_id) body.refund_id = params.refund_id;
  if (params.settlement_id) body.settlement_id = params.settlement_id;

  const result = await getClient().post("/receipts", body);
  return JSON.stringify(result, null, 2);
}

export async function handleListReceipts(params: z.infer<typeof listReceiptsSchema>): Promise<string> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  if (params.payment_id) query.set("payment_id", params.payment_id);
  if (params.refund_id) query.set("refund_id", params.refund_id);
  if (params.cursor) query.set("cursor", params.cursor);

  const result = await getClient().get(`/receipts?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}
