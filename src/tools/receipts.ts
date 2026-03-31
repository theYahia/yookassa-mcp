import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

export const createReceiptSchema = z.object({
  type: z.enum(["payment", "refund"]).describe("Тип чека"),
  payment_id: z.string().describe("ID платежа"),
  customer_email: z.string().email().describe("Email покупателя для чека"),
  items: z.array(z.object({
    description: z.string().describe("Название товара/услуги"),
    quantity: z.number().positive().describe("Количество"),
    amount: z.number().positive().describe("Цена за единицу в рублях"),
    vat_code: z.number().int().min(1).max(6).describe(
      "Код НДС: 1=без НДС, 2=0%, 3=10%, 4=20%, 5=расчётная 10/110, 6=расчётная 20/120"
    ),
  })).min(1).describe("Товары/услуги в чеке"),
});

export async function handleCreateReceipt(params: z.infer<typeof createReceiptSchema>): Promise<string> {
  const body = {
    type: params.type,
    payment_id: params.payment_id,
    customer: { email: params.customer_email },
    items: params.items.map(item => ({
      description: item.description,
      quantity: String(item.quantity),
      amount: formatAmount(item.amount),
      vat_code: item.vat_code,
    })),
  };

  const result = await getClient().post("/receipts", body);
  return JSON.stringify(result, null, 2);
}
