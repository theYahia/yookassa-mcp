import { z } from "zod";
import { getPayoutClient, formatAmount, moneyAmount, currencyCode } from "../client.js";

export const createPayoutSchema = z.object({
  amount: moneyAmount.describe("Сумма выплаты"),
  currency: currencyCode.describe("Валюта (ISO-4217, по умолчанию RUB)"),
  payout_token: z.string().optional().describe("Токен получателя из виджета выплат (предпочтительно; нужен если у вас нет PCI DSS для приёма сырого номера карты)"),
  destination_type: z.enum(["bank_card", "yoo_money", "sbp"]).optional().describe("Тип получателя (если не используется payout_token). bank_card требует сертификат PCI DSS"),
  destination_value: z.string().optional().describe("Реквизит получателя: номер карты (bank_card), номер кошелька (yoo_money) или телефон 79XXXXXXXXX (sbp)"),
  bank_id: z.string().optional().describe("ID банка-участника СБП (обязателен для destination_type=sbp)"),
  description: z.string().max(128).optional().describe("Описание выплаты"),
  metadata: z.record(z.string()).optional().describe("Произвольные метаданные"),
});

export const getPayoutSchema = z.object({
  payout_id: z.string().describe("ID выплаты"),
});

export async function handleCreatePayout(params: z.infer<typeof createPayoutSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    amount: formatAmount(params.amount, params.currency),
  };

  if (params.payout_token) {
    // Tokenized destination from the payout widget (no PCI DSS needed).
    body.payout_token = params.payout_token;
  } else {
    if (!params.destination_type || !params.destination_value) {
      throw new Error(
        "Укажите либо payout_token (из виджета выплат), либо destination_type + destination_value. " +
        "Приём сырого номера карты (bank_card) требует сертификата PCI DSS."
      );
    }
    const destination: Record<string, unknown> = { type: params.destination_type };
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
    body.payout_destination_data = destination;
  }

  if (params.description) body.description = params.description;
  if (params.metadata) body.metadata = params.metadata;

  const result = await getPayoutClient().post("/payouts", body);
  return JSON.stringify(result, null, 2);
}

export async function handleGetPayout(params: z.infer<typeof getPayoutSchema>): Promise<string> {
  const result = await getPayoutClient().get(`/payouts/${params.payout_id}`);
  return JSON.stringify(result, null, 2);
}
