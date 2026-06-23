import { z } from "zod";
import { getClient, formatAmount, formatKopecks, moneyAmount, toKopecks } from "../client.js";

export const receiptItemSchema = z.object({
  description: z.string().describe("Название товара/услуги"),
  quantity: z.number().positive().describe("Количество"),
  amount: moneyAmount.describe("Цена за единицу в рублях"),
  vat_code: z.number().int().min(1).max(6).describe(
    "Код НДС: 1=без НДС, 2=0%, 3=10%, 4=20%, 5=расчётная 10/110, 6=расчётная 20/120"
  ),
  payment_subject: z.string().optional().describe(
    "Признак предмета расчёта, тег 1212 (по умолчанию 'commodity'; для услуг — 'service')"
  ),
  payment_mode: z.string().optional().describe(
    "Признак способа расчёта, тег 1214 (по умолчанию 'full_payment')"
  ),
  measure: z.string().optional().describe(
    "Мера количества, тег 2108 (по умолчанию 'piece'; обязательна для ФФД 1.2 и Чеков от ЮKassa)"
  ),
});

export const createReceiptSchema = z.object({
  type: z.enum(["payment", "refund"]).describe("Тип чека"),
  payment_id: z.string().optional().describe("ID платежа (обязателен для type=payment)"),
  refund_id: z.string().optional().describe("ID возврата (обязателен для type=refund)"),
  customer_email: z.string().email().optional().describe("Email покупателя для чека"),
  customer_phone: z.string().optional().describe("Телефон покупателя (если нет email)"),
  tax_system_code: z.number().int().min(1).max(6).optional().describe(
    "Система налогообложения, тег 1055 (1-6). Передавайте только если у магазина несколько СНО или ФФД 1.2"
  ),
  items: z.array(receiptItemSchema).min(1).describe("Товары/услуги в чеке"),
  settlements: z.array(z.object({
    type: z.string().describe("Тип расчёта: cashless, prepayment, postpayment, consideration"),
    amount: moneyAmount.describe("Сумма расчёта"),
  })).optional().describe("Расчёты (settlements). Если не указано — авто: один 'cashless' на сумму позиций"),
  send: z.boolean().default(true).describe("Отправить чек покупателю (обязательно для отдельного чека)"),
  settlement_id: z.string().optional().describe("ID расчёта (для связки)"),
});

/** Build the receipt `items` array with 54-FZ fiscal attributes (defaults applied). */
export function buildReceiptItems(items: z.infer<typeof receiptItemSchema>[], currency = "RUB") {
  return items.map(item => ({
    description: item.description,
    quantity: String(item.quantity),
    amount: formatAmount(item.amount, currency),
    vat_code: item.vat_code,
    payment_subject: item.payment_subject ?? "commodity",
    payment_mode: item.payment_mode ?? "full_payment",
    measure: item.measure ?? "piece",
  }));
}

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

  // Standalone POST /receipts requires `settlements` and `send`. If settlements are not
  // supplied, build a single cashless settlement summing the item line totals.
  const settlements = params.settlements
    ? params.settlements.map(s => ({ type: s.type, amount: formatAmount(s.amount) }))
    : [{
        type: "cashless",
        amount: formatKopecks(
          params.items.reduce((sum, it) => sum + Math.round(toKopecks(it.amount) * it.quantity), 0),
        ),
      }];

  const body: Record<string, unknown> = {
    type: params.type,
    customer,
    send: params.send,
    items: buildReceiptItems(params.items),
    settlements,
  };

  if (params.tax_system_code !== undefined) body.tax_system_code = params.tax_system_code;
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
