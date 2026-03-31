import type { YooKassaError } from "./types.js";

const BASE_URL = "https://api.yookassa.ru/v3";
const TIMEOUT = 10_000;
const MAX_RETRIES = 3;

let _instance: YooKassaClient | null = null;

export function getClient(): YooKassaClient {
  if (!_instance) {
    _instance = new YooKassaClient();
  }
  return _instance;
}

/** For testing only */
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
        "Получите их в личном кабинете ЮKassa: Интеграция → Ключи API"
      );
    }

    this.authHeader = "Basic " + Buffer.from(`${sid}:${key}`).toString("base64");
  }

  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.request("POST", path, body);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${BASE_URL}${path}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);

      const headers: Record<string, string> = {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
      };

      if (method === "POST") {
        headers["Idempotence-Key"] = crypto.randomUUID();
      }

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          return response.json();
        }

        const errorBody = await response.text();
        let parsed: YooKassaError | null = null;
        try {
          parsed = JSON.parse(errorBody) as YooKassaError;
        } catch {
          // не JSON
        }

        // Retry на 429 и 5xx
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.error(`[yookassa-mcp] ${response.status} от ${path}, повтор через ${delay}мс (${attempt}/${MAX_RETRIES})`);

          if (response.status >= 500) {
            console.error("[yookassa-mcp] ВНИМАНИЕ: HTTP 500 — результат операции неопределён. Проверьте GET-запросом.");
          }

          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Формируем читаемую ошибку
        if (parsed?.type === "error") {
          const hint = response.status === 401
            ? " Проверьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY."
            : "";
          const param = parsed.parameter ? ` (параметр: ${parsed.parameter})` : "";
          throw new Error(`ЮKassa [${parsed.code}]: ${parsed.description}${param}${hint}`);
        }

        throw new Error(`ЮKassa HTTP ${response.status}: ${errorBody}`);
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof DOMException && error.name === "AbortError") {
          if (attempt < MAX_RETRIES) {
            console.error(`[yookassa-mcp] Таймаут ${path}, повтор (${attempt}/${MAX_RETRIES})`);
            continue;
          }
          throw new Error("ЮKassa: таймаут запроса (10 секунд). Попробуйте позже.");
        }
        throw error;
      }
    }

    throw new Error("ЮKassa: все попытки исчерпаны");
  }
}

/** Конвертация числа в строку формата ЮKassa: 100 → "100.00" */
export function formatAmount(amount: number, currency = "RUB"): { value: string; currency: string } {
  return { value: amount.toFixed(2), currency };
}
