import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock env vars before importing modules
process.env.YOOKASSA_SHOP_ID = "test_shop_123";
process.env.YOOKASSA_SECRET_KEY = "test_secret_key";

import {
  handleCreatePayment,
  handleGetPayment,
  handleCapturePayment,
  handleCancelPayment,
  handleListPayments,
  handleSavePaymentMethod,
  handleCreateRecurringPayment,
  handleCreateSbpPayment,
  handleCreateSplitPayment,
} from "../src/tools/payments.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockOk(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function mockError(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("create_payment", () => {
  it("creates a payment with basic params", async () => {
    const paymentResp = {
      id: "pay_123",
      status: "pending",
      amount: { value: "1000.00", currency: "RUB" },
      confirmation: { type: "redirect", confirmation_url: "https://yookassa.ru/pay/123" },
    };
    mockFetch.mockResolvedValueOnce(mockOk(paymentResp));

    const result = JSON.parse(await handleCreatePayment({
      amount: 1000,
      currency: "RUB",
      description: "Test order",
      capture: true,
    }));

    expect(result.id).toBe("pay_123");
    expect(result.status).toBe("pending");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.yookassa.ru/v3/payments");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.amount.value).toBe("1000.00");
    expect(body.description).toBe("Test order");
  });

  it("includes receipt when email and items provided", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_456" }));

    await handleCreatePayment({
      amount: 500,
      currency: "RUB",
      description: "With receipt",
      capture: true,
      receipt_email: "test@example.com",
      receipt_items: [
        { description: "Item 1", quantity: 2, amount: 250, vat_code: 4 },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.receipt).toBeDefined();
    expect(body.receipt.customer.email).toBe("test@example.com");
    expect(body.receipt.items).toHaveLength(1);
    expect(body.receipt.items[0].vat_code).toBe(4);
  });

  it("includes metadata when provided", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_789" }));

    await handleCreatePayment({
      amount: 100,
      currency: "RUB",
      description: "With meta",
      capture: true,
      metadata: { order_id: "abc123" },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.metadata).toEqual({ order_id: "abc123" });
  });
});

describe("get_payment", () => {
  it("fetches a payment by ID", async () => {
    const resp = { id: "pay_123", status: "succeeded", amount: { value: "1000.00", currency: "RUB" } };
    mockFetch.mockResolvedValueOnce(mockOk(resp));

    const result = JSON.parse(await handleGetPayment({ payment_id: "pay_123" }));
    expect(result.id).toBe("pay_123");
    expect(result.status).toBe("succeeded");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.yookassa.ru/v3/payments/pay_123");
    expect(opts.method).toBe("GET");
  });
});

describe("capture_payment", () => {
  it("captures a payment with full amount", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_123", status: "succeeded" }));

    const result = JSON.parse(await handleCapturePayment({ payment_id: "pay_123" }));
    expect(result.status).toBe("succeeded");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({});
  });

  it("captures a partial amount", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_123", status: "succeeded" }));

    await handleCapturePayment({ payment_id: "pay_123", amount: 500 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.amount.value).toBe("500.00");
  });
});

describe("cancel_payment", () => {
  it("cancels a payment", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_123", status: "canceled" }));

    const result = JSON.parse(await handleCancelPayment({ payment_id: "pay_123" }));
    expect(result.status).toBe("canceled");
  });
});

describe("list_payments", () => {
  it("lists payments with filters", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ type: "list", items: [{ id: "pay_1" }] }));

    const result = JSON.parse(await handleListPayments({
      limit: 5,
      status: "succeeded",
      created_at_gte: "2026-01-01T00:00:00.000Z",
    }));

    expect(result.items).toHaveLength(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=5");
    expect(url).toContain("status=succeeded");
  });
});

describe("save_payment_method", () => {
  it("creates a payment with save_payment_method=true", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_bind", payment_method: { id: "pm_123", saved: true } }));

    const result = JSON.parse(await handleSavePaymentMethod({
      amount: 1,
      currency: "RUB",
      description: "Bind card",
      return_url: "https://example.com/return",
      payment_method_type: "bank_card",
    }));

    expect(result.payment_method.saved).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.save_payment_method).toBe(true);
  });
});

describe("create_recurring_payment", () => {
  it("charges a saved payment method", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_rec", status: "succeeded" }));

    const result = JSON.parse(await handleCreateRecurringPayment({
      payment_method_id: "pm_123",
      amount: 500,
      currency: "RUB",
      description: "Monthly subscription",
    }));

    expect(result.status).toBe("succeeded");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payment_method_id).toBe("pm_123");
    expect(body.amount.value).toBe("500.00");
  });
});

describe("create_sbp_payment", () => {
  it("creates a payment via SBP", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_sbp", confirmation: { type: "redirect" } }));

    await handleCreateSbpPayment({
      amount: 1000,
      currency: "RUB",
      description: "SBP test",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payment_method_data.type).toBe("sbp");
  });
});

describe("create_split_payment", () => {
  it("creates a split payment with transfers", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: "pay_split" }));

    await handleCreateSplitPayment({
      amount: 10000,
      currency: "RUB",
      description: "Marketplace order",
      transfers: [
        { account_id: "shop_1", amount: 7000, description: "Seller" },
        { account_id: "shop_2", amount: 3000 },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.transfers).toHaveLength(2);
    expect(body.transfers[0].account_id).toBe("shop_1");
    expect(body.transfers[0].amount.value).toBe("7000.00");
    expect(body.transfers[1].account_id).toBe("shop_2");
  });
});

describe("error handling", () => {
  it("retries on 429 and eventually throws", async () => {
    mockFetch.mockResolvedValue(mockError(429, { type: "error", id: "e1", code: "too_many_requests", description: "Rate limit" }));

    await expect(handleGetPayment({ payment_id: "pay_x" })).rejects.toThrow("too_many_requests");
    // 3 attempts (MAX_RETRIES)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws clear error on 401", async () => {
    mockFetch.mockResolvedValueOnce(mockError(401, { type: "error", id: "e2", code: "unauthorized", description: "Invalid credentials" }));

    await expect(handleGetPayment({ payment_id: "pay_x" })).rejects.toThrow("YOOKASSA_SHOP_ID");
  });
});
