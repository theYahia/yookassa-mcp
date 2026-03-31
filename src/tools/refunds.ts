import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

export const createRefundSchema = z.object({
  payment_id: z.string().describe("ID платежа для возврата"),
  amount: z.number().positive().describe("Сумма возврата в рублях"),
  description: z.string().optional().describe("Причина возврата"),
});

export const getRefundSchema = z.object({
  refund_id: z.string().describe("ID возврата"),
});

export const listRefundsSchema = z.object({
  payment_id: z.string().optional().describe("Фильтр по ID платежа"),
  limit: z.number().int().min(1).max(100).default(10).describe("Количество (1-100)"),
});

export async function handleCreateRefund(params: z.infer<typeof createRefundSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    payment_id: params.payment_id,
    amount: formatAmount(params.amount),
  };
  if (params.description) body.description = params.description;

  const result = await getClient().post("/refunds", body);
  return JSON.stringify(result, null, 2);
}

export async function handleGetRefund(params: z.infer<typeof getRefundSchema>): Promise<string> {
  const result = await getClient().get(`/refunds/${params.refund_id}`);
  return JSON.stringify(result, null, 2);
}

export async function handleListRefunds(params: z.infer<typeof listRefundsSchema>): Promise<string> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  if (params.payment_id) query.set("payment_id", params.payment_id);

  const result = await getClient().get(`/refunds?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}
