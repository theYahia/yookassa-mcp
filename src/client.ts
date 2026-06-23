import type { YooKassaError } from "./types.js";

const BASE_URL = "https://api.yookassa.ru/v3";
// YooKassa may take up to ~30s to produce an answer (HTTP 500 means "no answer in time").
// Keep the client timeout above that window so a slow-but-successful create is not aborted
// client-side and then retried. Retries are safe because the Idempotence-Key is stable.
const TIMEOUT = 35_000;
const MAX_RETRIES = 3;

let _instance: YooKassaClient | null = null;

/** Lazy singleton -- created on first use so tests can set env vars before import */
export function getClient(): YooKassaClient {
  if (!_instance) _instance = new YooKassaClient();
  return _instance;
}

/** Reset singleton (for tests) */
export function resetClient(): void {
  _instance = null;
}

export class YooKassaClient {
  private authHeader: string;

  constructor(shopId?: string, secretKey?: string) {
    const sid = shopId ?? process.env.YOOKASSA_SHOP_ID ?? "";
    const key = secretKey ?? process.env.YOOKASSA_SECRET_KEY ?? "";

    if (!sid || !key) {
      throw new Error(
        "Переменные окружения YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY обязательны. " +
        "Получите их в личном кабинете ЮKassa: Интеграция -> Ключи API"
      );
    }

    this.authHeader = "Basic " + Buffer.from(`${sid}:${key}`).toString("base64");
  }

  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    return this.request("POST", path, body, idempotencyKey);
  }

  async delete(path: string, idempotencyKey?: string): Promise<unknown> {
    return this.request("DELETE", path, undefined, idempotencyKey);
  }

  private async request(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    const url = `${BASE_URL}${path}`;

    // The Idempotence-Key is generated ONCE per logical operation and reused on every
    // retry attempt. YooKassa treats a retry carrying the same body but a DIFFERENT key
    // as a brand-new request ("если данные в запросе те же, а ключ идемпотентности
    // отличается, запрос выполняется как новый") — regenerating it per attempt would
    // duplicate a payment/refund/payout. Required for POST and DELETE.
    const needsKey = method === "POST" || method === "DELETE";
    const key = needsKey ? (idempotencyKey ?? crypto.randomUUID()) : undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);

      const headers: Record<string, string> = {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
      };

      if (key) {
        headers["Idempotence-Key"] = key;
      }

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        // DELETE with 204 returns no content
        if (response.ok && response.status === 204) {
          return { success: true };
        }

        if (response.ok) {
          return response.json();
        }

        const errorBody = await response.text();
        let parsed: YooKassaError | null = null;
        try {
          parsed = JSON.parse(errorBody) as YooKassaError;
        } catch {
          // not JSON
        }

        // Retry on 429 and 5xx
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.error(`[yookassa-mcp] ${response.status} from ${path}, retry in ${delay}ms (${attempt}/${MAX_RETRIES})`);

          if (response.status >= 500 && needsKey) {
            // 5xx means the operation result is undefined server-side; the retry reuses the
            // same Idempotence-Key, so YooKassa de-duplicates it (returns the original result
            // rather than creating a second payment/refund/payout). If retries are exhausted,
            // verify the final state with a GET before assuming failure.
            console.error("[yookassa-mcp] WARNING: HTTP 5xx -- result undefined; retrying with the same Idempotence-Key (verify via GET if it ultimately fails).");
          }

          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Readable error
        if (parsed?.type === "error") {
          const hint = response.status === 401
            ? " Check YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY."
            : "";
          const param = parsed.parameter ? ` (param: ${parsed.parameter})` : "";
          throw new Error(`YooKassa [${parsed.code}]: ${parsed.description}${param}${hint}`);
        }

        throw new Error(`YooKassa HTTP ${response.status}: ${errorBody}`);
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof DOMException && error.name === "AbortError") {
          if (attempt < MAX_RETRIES) {
            console.error(`[yookassa-mcp] Timeout ${path}, retry (${attempt}/${MAX_RETRIES})`);
            continue;
          }
          throw new Error(`YooKassa: request timeout (${TIMEOUT / 1000}s). Try again later.`);
        }
        throw error;
      }
    }

    throw new Error("YooKassa: all retries exhausted");
  }
}

/** Convert number to YooKassa amount format: 100 -> "100.00" */
export function formatAmount(amount: number, currency = "RUB"): { value: string; currency: string } {
  return { value: amount.toFixed(2), currency };
}
