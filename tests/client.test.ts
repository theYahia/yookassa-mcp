import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { YooKassaClient, formatAmount, resetClient } from "../src/client.js";

describe("YooKassaClient", () => {
  beforeEach(() => {
    resetClient();
  });

  it("throws without credentials", () => {
    const origId = process.env.YOOKASSA_SHOP_ID;
    const origKey = process.env.YOOKASSA_SECRET_KEY;
    delete process.env.YOOKASSA_SHOP_ID;
    delete process.env.YOOKASSA_SECRET_KEY;

    expect(() => new YooKassaClient()).toThrow("YOOKASSA_SHOP_ID");

    process.env.YOOKASSA_SHOP_ID = origId;
    process.env.YOOKASSA_SECRET_KEY = origKey;
  });

  it("creates with explicit credentials", () => {
    const client = new YooKassaClient("shop_123", "key_456");
    expect(client).toBeDefined();
  });
});

describe("formatAmount", () => {
  it("formats integer amount", () => {
    expect(formatAmount(100)).toEqual({ value: "100.00", currency: "RUB" });
  });

  it("formats decimal amount", () => {
    expect(formatAmount(99.99)).toEqual({ value: "99.99", currency: "RUB" });
  });

  it("uses custom currency", () => {
    expect(formatAmount(50, "USD")).toEqual({ value: "50.00", currency: "USD" });
  });
});

describe("HTTP calls with mocked fetch", () => {
  let client: YooKassaClient;

  beforeEach(() => {
    client = new YooKassaClient("test_shop", "test_key");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET sends Authorization header", async () => {
    const mockResponse = { id: "pay_123", status: "succeeded" };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await client.get("/payments/pay_123");
    expect(result).toEqual(mockResponse);

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Basic /);
  });

  it("POST includes Idempotence-Key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "pay_new" }), { status: 200 }),
    );

    await client.post("/payments", { amount: { value: "100.00", currency: "RUB" } });

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Idempotence-Key"]).toBeDefined();
    expect(headers["Idempotence-Key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("each POST gets unique Idempotence-Key", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await client.post("/payments", {});
    await client.post("/payments", {});

    const key1 = (vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)["Idempotence-Key"];
    const key2 = (vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>)["Idempotence-Key"];
    expect(key1).not.toBe(key2);
  });

  it("handles 401 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        type: "error", id: "err_1", code: "unauthorized",
        description: "Invalid credentials",
      }), { status: 401 }),
    );

    await expect(client.get("/me")).rejects.toThrow("YOOKASSA_SHOP_ID");
  });

  it("handles 403 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        type: "error", id: "err_2", code: "forbidden",
        description: "Access denied",
      }), { status: 403 }),
    );

    await expect(client.get("/payments")).rejects.toThrow("Access denied");
  });

  it("handles 404 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        type: "error", id: "err_3", code: "not_found",
        description: "Payment not found",
      }), { status: 404 }),
    );

    await expect(client.get("/payments/nonexistent")).rejects.toThrow("Payment not found");
  });

  it("retries on 429 then succeeds", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await client.get("/payments");
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 then succeeds", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await client.get("/payments");
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fails after max retries on 429", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("rate limited", { status: 429 }));

    await expect(client.get("/payments")).rejects.toThrow("HTTP 429");
  });
});
