import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.YOOKASSA_SHOP_ID = "test_shop_123";
process.env.YOOKASSA_SECRET_KEY = "test_secret_key";

import { handleCreateRefund, handleGetRefund, handleListRefunds } from "../src/tools/refunds.js";
import { handleCreateReceipt, handleListReceipts } from "../src/tools/receipts.js";
import { handleGetBalance } from "../src/tools/balance.js";
import { handleCreatePayout, handleGetPayout } from "../src/tools/payouts.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockOk(data: unknown) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

beforeEach(() => { mockFetch.mockReset(); });

describe("refunds", () => {
  it("creates a refund", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "ref_1", status: "succeeded", amount: { value: "500.00", currency: "RUB" } }));

    const result = JSON.parse(await handleCreateRefund({ payment_id: "pay_1", amount: 500 }));
    expect(result.status).toBe("succeeded");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payment_id).toBe("pay_1");
    expect(body.amount.value).toBe("500.00");
  });

  it("gets a refund", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "ref_1", status: "succeeded" }));
    const result = JSON.parse(await handleGetRefund({ refund_id: "ref_1" }));
    expect(result.id).toBe("ref_1");
  });

  it("lists refunds", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ type: "list", items: [{ id: "ref_1" }] }));
    const result = JSON.parse(await handleListRefunds({ limit: 10 }));
    expect(result.items).toHaveLength(1);
  });
});

describe("receipts", () => {
  it("creates a receipt", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "rc_1", type: "payment", status: "pending" }));

    const result = JSON.parse(await handleCreateReceipt({
      type: "payment",
      payment_id: "pay_1",
      customer_email: "buyer@test.com",
      items: [{ description: "Service", quantity: 1, amount: 1000, vat_code: 4 }],
    }));

    expect(result.id).toBe("rc_1");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.customer.email).toBe("buyer@test.com");
    expect(body.items[0].amount.value).toBe("1000.00");
  });

  it("lists receipts", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ type: "list", items: [{ id: "rc_1" }] }));
    const result = JSON.parse(await handleListReceipts({ limit: 10 }));
    expect(result.items).toHaveLength(1);
  });
});

describe("balance", () => {
  it("gets shop info", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ account_id: "123", test: true, status: "enabled" }));
    const result = JSON.parse(await handleGetBalance());
    expect(result.account_id).toBe("123");
  });
});

describe("payouts", () => {
  it("creates a payout", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "po_1", status: "pending", amount: { value: "5000.00", currency: "RUB" } }));

    const result = JSON.parse(await handleCreatePayout({
      amount: 5000,
      currency: "RUB",
      destination_type: "bank_card",
      destination_value: "4111111111111111",
      description: "Payout to seller",
    }));

    expect(result.id).toBe("po_1");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.amount.value).toBe("5000.00");
    expect(body.payout_destination_data.type).toBe("bank_card");
  });

  it("gets a payout", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "po_1", status: "succeeded" }));
    const result = JSON.parse(await handleGetPayout({ payout_id: "po_1" }));
    expect(result.status).toBe("succeeded");
  });
});
