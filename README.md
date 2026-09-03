# ЮKassa MCP — приём платежей и чеки 54-ФЗ из Claude и других AI-агентов

Если вы искали, как подключить ЮKassa к нейросети, проводить платежи и возвраты прямо в диалоге или автоматизировать фискальные чеки по 54-ФЗ без написания кода — это оно. 20 инструментов закрывают весь оборот денег: платежи, возвраты, чеки, выплаты, вебхуки, рекуррентные списания, СБП и сплиты маркетплейса. Ставится в Claude Desktop, Cursor или любой MCP-клиент одной строкой конфига.

[![npm](https://img.shields.io/npm/v/@theyahia/yookassa-mcp)](https://www.npmjs.com/package/@theyahia/yookassa-mcp)
[![CI](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@theyahia/yookassa-mcp)](https://smithery.ai/server/@theyahia/yookassa-mcp)

Часть серии [WWmcp](https://github.com/theYahia/WWmcp) от [@theYahia](https://github.com/theYahia).

## Быстрый старт

### Claude Desktop

```json
{
  "mcpServers": {
    "yookassa": {
      "command": "npx",
      "args": ["-y", "@theyahia/yookassa-mcp"],
      "env": {
        "YOOKASSA_SHOP_ID": "your-shop-id",
        "YOOKASSA_SECRET_KEY": "your-secret-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add yookassa -e YOOKASSA_SHOP_ID=your-id -e YOOKASSA_SECRET_KEY=your-key -- npx -y @theyahia/yookassa-mcp
```

### VS Code / Cursor

```json
{
  "servers": {
    "yookassa": {
      "command": "npx",
      "args": ["-y", "@theyahia/yookassa-mcp"],
      "env": {
        "YOOKASSA_SHOP_ID": "your-shop-id",
        "YOOKASSA_SECRET_KEY": "your-secret-key"
      }
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "yookassa": {
      "command": "npx",
      "args": ["-y", "@theyahia/yookassa-mcp"],
      "env": {
        "YOOKASSA_SHOP_ID": "your-shop-id",
        "YOOKASSA_SECRET_KEY": "your-secret-key"
      }
    }
  }
}
```

### Streamable HTTP (удалённый сервер / Docker)

> ⚠️ **HTTP-транспорт открывает инструменты, которые двигают деньги.** Он требует Bearer-токен,
> по умолчанию слушает `127.0.0.1` и проверяет `Host`/`Origin` (защита от DNS-rebinding).
> Никогда не выставляйте его напрямую в интернет — только за обратным прокси с аутентификацией или mTLS.
> См. [SECURITY.md](SECURITY.md).

```bash
MCP_AUTH_TOKEN="$(openssl rand -hex 32)" HTTP_PORT=3000 npx -y @theyahia/yookassa-mcp --http
```

Затем обращайтесь к `/mcp` с заголовком `Authorization: Bearer <MCP_AUTH_TOKEN>`.

Эндпоинты:
- `POST /mcp` — транспорт MCP Streamable HTTP (нужен Bearer-токен; stateless — только POST)
- `GET /health` — проверка состояния без авторизации (`{ "status": "ok", "tools": <count> }`)

## Переменные окружения

| Переменная | Обяз. | Описание |
|----------|:--------:|-------------|
| `YOOKASSA_SHOP_ID` | да | ID магазина (Настройки → Магазин) |
| `YOOKASSA_SECRET_KEY` | да | Секретный ключ (Интеграция → Ключи API) |
| `YOOKASSA_PAYOUT_AGENT_ID` | для выплат | ID шлюза (agentId) продукта «Выплаты» (Настройки → Выплаты) |
| `YOOKASSA_PAYOUT_SECRET_KEY` | для выплат | Секретный ключ шлюза выплат |
| `HTTP_PORT` | нет | Порт HTTP-транспорта (по умолчанию 3000); включает режим `--http` |
| `MCP_AUTH_TOKEN` | только HTTP | **Обязателен в HTTP-режиме.** Bearer-токен, который клиенты шлют на `/mcp` |
| `HTTP_HOST` | нет | Адрес привязки в HTTP-режиме (по умолчанию `127.0.0.1`; `0.0.0.0` — только за прокси) |
| `MCP_ALLOWED_HOSTS` | нет | Список разрешённых `Host` через запятую (по умолчанию `127.0.0.1:<port>,localhost:<port>`) |
| `MCP_ALLOWED_ORIGINS` | нет | Список разрешённых браузерных `Origin` (CORS) через запятую (по умолчанию пусто — браузерные origin отклоняются) |
| `YOOKASSA_DEBUG` | нет | `1` — трассировать каждый запрос (метод/путь/статус/задержка/ключ идемпотентности) в stderr; секреты, заголовок авторизации и тела запросов не логируются |

## Тестовый режим и безопасность

Сервер выполняет **реальные денежные операции**. На время разработки:

1. Заведите **тестовый магазин** в [личном кабинете ЮKassa](https://yookassa.ru/my/shop-settings) и
   используйте его `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY`.
2. Убедитесь, что вы в тестовом режиме — вызовите **`get_shop_info`** и проверьте `"test": true` —
   **до** переключения на боевой магазин.
3. В **боевом** магазине `create_payment`, `create_refund`, `create_payout`, `create_recurring_payment`,
   `save_payment_method` и `capture_payment` двигают реальные деньги и **необратимы**. Эти инструменты
   помечены как разрушающие, чтобы MCP-клиенты спрашивали подтверждение перед запуском.
4. HTTP-транспорт по умолчанию отказывает без авторизации и слушает localhost — перед любым удалённым
   развёртыванием прочитайте [SECURITY.md](SECURITY.md).

## Инструменты (20)

### Платежи (9)

| Инструмент | Описание |
|------|-------------|
| `create_payment` | Создать платёж с суммой, описанием и способом оплаты. Возвращает ссылку на оплату. Поддерживает чеки и метаданные |
| `get_payment` | Данные платежа по ID — статус, сумма, ссылка подтверждения, метаданные |
| `capture_payment` | Подтвердить двухстадийный платёж (списать удержанные средства). Частичное списание поддерживается |
| `cancel_payment` | Отменить платёж (в статусе pending или waiting_for_capture) |
| `list_payments` | Список платежей с фильтрами по статусу, периоду и пагинацией |
| `save_payment_method` | Сохранить способ оплаты для рекуррентных списаний (привязка карты) |
| `create_recurring_payment` | Списать по сохранённому способу оплаты (без участия пользователя) |
| `create_sbp_payment` | Создать платёж через СБП (Система быстрых платежей) |
| `create_split_payment` | Сплит-платёж для маркетплейсов — распределение денег между партнёрами |

### Возвраты (3)

| Инструмент | Описание |
|------|-------------|
| `create_refund` | Полный или частичный возврат по ID платежа |
| `get_refund` | Данные возврата по ID |
| `list_refunds` | Список возвратов с необязательным фильтром по платежу |

### Чеки (2)

| Инструмент | Описание |
|------|-------------|
| `create_receipt` | Фискальный чек (54-ФЗ) — позиции, коды НДС, контакты покупателя |
| `list_receipts` | Список чеков по ID платежа или возврата |

### Выплаты (2)

> ⚠️ **Выплаты — отдельно подключаемый продукт ЮKassa** со своими реквизитами шлюза
> (`YOOKASSA_PAYOUT_AGENT_ID` + `YOOKASSA_PAYOUT_SECRET_KEY`), это не платёжный ключ магазина.
> Передача сырого номера карты требует сертификата PCI DSS — без него собирайте реквизиты получателя
> через виджет выплат и передавайте `payout_token`. Выплаты асинхронные (опрашивайте `get_payout`).

| Инструмент | Описание |
|------|-------------|
| `create_payout` | Выплата на банковскую карту, кошелёк ЮMoney или через СБП, либо по `payout_token` |
| `get_payout` | Статус и детали выплаты по ID |

### Вебхуки (3)

| Инструмент | Описание |
|------|-------------|
| `create_webhook` | Зарегистрировать URL вебхука для событий (payment.succeeded, refund.succeeded и т. д.) |
| `list_webhooks` | Список всех зарегистрированных вебхуков |
| `delete_webhook` | Удалить вебхук по ID |

### Аккаунт (1)

| Инструмент | Описание |
|------|-------------|
| `get_shop_info` | Информация о магазине — ID, статус, тестовый режим, фискализация (эндпоинта баланса в ЮKassa нет) |

## Демо-промпты

```
Создай платёж на 5000 рублей по заказу #123 со способом оплаты СБП
```

```
Настрой рекуррентную подписку: привяжи карту списанием 1 рубля, потом списывай 999 рублей ежемесячно по сохранённому способу
```

```
Покажи все успешные платежи за последние 7 дней и сделай возврат 2500 рублей по платежу pay_xxx
```

## Архитектура

- **Авторизация**: HTTP Basic Auth (`YOOKASSA_SHOP_ID:YOOKASSA_SECRET_KEY`)
- **Базовый URL**: `https://api.yookassa.ru/v3/`
- **Idempotence-Key**: один стабильный UUID v4 на каждый логический POST/DELETE-запрос, сохраняется при повторах (повторный запрос дедуплицируется на стороне ЮKassa, двойного списания не будет). Вызывающая сторона может передать свой ключ.
- **Таймаут**: 35 секунд (больше, чем окно ответа ЮKassa ~30 с, чтобы медленная, но успешная операция не обрывалась на клиенте)
- **Повторы**: 3 попытки на 429/5xx/таймаут с экспоненциальной задержкой (1 с, 2 с, 4 с); повторы переиспользуют тот же Idempotence-Key и безопасно дедуплицируются
- **Транспорт**: stdio (по умолчанию) или Streamable HTTP (`--http` / `HTTP_PORT`)

## Часть серии WWmcp

| MCP | Статус | Описание |
|-----|--------|-------------|
| [@metarebalance/dadata-mcp](https://github.com/theYahia/dadata-mcp) | готов | Адреса, компании, банки, телефоны |
| [@theyahia/cbr-mcp](https://github.com/theYahia/cbr-mcp) | готов | Курсы валют, ключевая ставка |
| [@theyahia/yookassa-mcp](https://github.com/theYahia/yookassa-mcp) | готов | Платежи, возвраты, чеки, выплаты, вебхуки |
| [@theyahia/cloudpayments-mcp](https://github.com/theYahia/cloudpayments-mcp) | готов | Платежи, подписки, заказы |
| ... | | **46 серверов** — [полный список](https://github.com/theYahia/WWmcp) |

## Лицензия

MIT

---

Часть [WWmcp](https://github.com/theYahia/WWmcp) · Telegram: [@vhodvai](https://t.me/vhodvai)
