import { z } from "zod";
import { getClient, formatAmount } from "../client.js";

export const createPayoutSchema = z.object({
  amount: z.number().positive().describe("Сумма выплаты"),
  currency: z.string().default("RUB").describe("Валюта"),
  destination_type: z.enum(["bank_card", "yoo_money", "sbp"]).describe("Тип получателя выплаты"),
  destination_value: z.string().describe("Реквизит получателя: номер карты (bank_card), номер кошелька (yoo_money) или телефон в формате 79XXXXXXXXX (sbp)"),
  bank_id: z.string().optional().describe("ID банка-участника СБП (обязателен для destination_type=sbp). См. список участников СБП в API ЮKassa"),
  description: z.string().max(128).optional().describe("Описание выплаты"),
  metadata: z.record(z.string()).optional().describe("Произвольные метаданные"),
});

export const getPayoutSchema = z.object({
  payout_id: z.string().describe("ID выплаты"),
});

export async function handleCreatePayout(params: z.infer<typeof createPayoutSchema>): Promise<string> {
  const destination: Record<string, unknown> = {
    type: params.destination_type,
  };

  if (params.destination_type === "bank_card") {
    // YooKassa expects card as a nested object { number }, NOT a JSON string.
    destination.card = { number: params.destination_value };
  } else if (params.destination_type === "yoo_money") {
    destination.account_number = params.destination_value;
  } else if (params.destination_type === "sbp") {
    if (!params.bank_id) {
      throw new Error(
        "Для выплаты по СБП обязателен bank_id (ID банка-участника СБП), помимо телефона в destination_value."
      );
    }
    destination.phone = params.destination_value;
    destination.bank_id = params.bank_id;
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
