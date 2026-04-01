import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

export const createPayoutSchema = z.object({
  amount: z.number().positive().describe("Сумма выплаты"),
  currency: z.string().default("RUB").describe("Валюта"),
  destination_type: z.enum(["bank_card", "yoo_money", "sbp"]).describe("Тип получателя выплаты"),
  destination_value: z.string().describe("Реквизит получателя (номер карты, кошелька или телефон для СБП)"),
  description: z.string().max(128).optional().describe("Описание выплаты"),
  metadata: z.record(z.string()).optional().describe("Произвольные метаданные"),
});

export const getPayoutSchema = z.object({
  payout_id: z.string().describe("ID выплаты"),
});

export async function handleCreatePayout(params: z.infer<typeof createPayoutSchema>): Promise<string> {
  const destination: Record<string, string> = {
    type: params.destination_type,
  };

  if (params.destination_type === "bank_card") {
    destination.card = JSON.stringify({ number: params.destination_value });
  } else if (params.destination_type === "yoo_money") {
    destination.account_number = params.destination_value;
  } else if (params.destination_type === "sbp") {
    destination.phone = params.destination_value;
  }

  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
    payout_destination_data: destination,
  };

  if (params.description) body.description = params.description;
  if (params.metadata) body.metadata = params.metadata;

  const result = await getClient().post("/payouts", body);
  return JSON.stringify(result, null, 2);
}

export async function handleGetPayout(params: z.infer<typeof getPayoutSchema>): Promise<string> {
  const result = await getClient().get(`/payouts/${params.payout_id}`);
  return JSON.stringify(result, null, 2);
}
