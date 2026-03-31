# @theyahia/yookassa-mcp

MCP-сервер для ЮKassa API: платежи, возвраты, чеки 54-ФЗ. **10 инструментов.** Первый MCP-сервер для ЮKassa.

[![npm](https://img.shields.io/npm/v/@theyahia/yookassa-mcp)](https://www.npmjs.com/package/@theyahia/yookassa-mcp)
[![CI](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@theyahia/yookassa-mcp)](https://smithery.ai/server/@theyahia/yookassa-mcp)

Часть серии [Russian API MCP](https://github.com/theYahia/russian-mcp) (50 серверов) by [@theYahia](https://github.com/theYahia).

## Quick Start

### Claude Desktop

Файл: `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yookassa": {
      "command": "npx",
      "args": ["-y", "@theyahia/yookassa-mcp"],
      "env": {
        "YOOKASSA_SHOP_ID": "ваш-shop-id",
        "YOOKASSA_SECRET_KEY": "ваш-секретный-ключ"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add yookassa -e YOOKASSA_SHOP_ID=ваш-id -e YOOKASSA_SECRET_KEY=ваш-ключ -- npx -y @theyahia/yookassa-mcp
```

### VS Code / Cursor

Файл: `.vscode/mcp.json`

```json
{
  "servers": {
    "yookassa": {
      "command": "npx",
      "args": ["-y", "@theyahia/yookassa-mcp"],
      "env": {
        "YOOKASSA_SHOP_ID": "ваш-shop-id",
        "YOOKASSA_SECRET_KEY": "ваш-секретный-ключ"
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
        "YOOKASSA_SHOP_ID": "ваш-shop-id",
        "YOOKASSA_SECRET_KEY": "ваш-секретный-ключ"
      }
    }
  }
}
```

### Streamable HTTP (remote / Docker)

```bash
HTTP_PORT=3000 npx -y @theyahia/yookassa-mcp --http
```

Или через переменную окружения:

```bash
export HTTP_PORT=3000
npx -y @theyahia/yookassa-mcp
```

Эндпоинты:
- `POST /mcp` — MCP Streamable HTTP transport
- `GET /health` — health check (`{ "status": "ok", "tools": 10 }`)

CORS включён для всех origin.

## Переменные окружения

| Переменная | Обязательна | Описание |
|------------|:-----------:|----------|
| `YOOKASSA_SHOP_ID` | Да | ID магазина (Настройки - Магазин) |
| `YOOKASSA_SECRET_KEY` | Да | Секретный ключ (Интеграция - Ключи API) |
| `HTTP_PORT` | Нет | Порт для HTTP-транспорта (по умолчанию 3000) |

Для тестирования создайте демо-магазин в [личном кабинете ЮKassa](https://yookassa.ru/my/shop-settings).

## Инструменты (10)

### Платежи (5)

| Инструмент | Описание |
|------------|----------|
| `create_payment` | Создать платёж — сумма, описание, способ оплаты. Возвращает ссылку на оплату |
| `get_payment` | Информация о платеже по ID |
| `capture_payment` | Подтвердить платёж (для двухстадийных). Частичное подтверждение |
| `cancel_payment` | Отменить платёж |
| `list_payments` | Список платежей с фильтрами по статусу и дате |

### Возвраты (3)

| Инструмент | Описание |
|------------|----------|
| `create_refund` | Полный или частичный возврат по платежу |
| `get_refund` | Информация о возврате по ID |
| `list_refunds` | Список возвратов |

### Чеки 54-ФЗ (1)

| Инструмент | Описание |
|------------|----------|
| `create_receipt` | Кассовый чек 54-ФЗ — товары, НДС, email покупателя |

### Аккаунт (1)

| Инструмент | Описание |
|------------|----------|
| `get_balance` | Статус магазина, тест/продакшн, фискализация |

## Примеры запросов

**Создать платёж:**
```
Создай платёж на 5000 рублей для заказа #123
```

**Возврат:**
```
Сделай возврат по платежу pay_xxx на 2500 рублей
```

**Список платежей:**
```
Покажи все успешные платежи за последние 7 дней
```

**Чек 54-ФЗ:**
```
Создай чек для платежа pay_xxx, email покупателя test@example.com, товар "Консультация" 5000р НДС 20%
```

**Статус магазина:**
```
Какой статус моего магазина?
```

## Чеки 54-ФЗ

Сервер поддерживает формирование кассовых чеков по 54-ФЗ через инструмент `create_receipt`.

Параметры чека:
- **type** — `payment` (приход) или `refund` (возврат прихода)
- **payment_id** — ID платежа
- **customer_email** — email покупателя (обязателен для отправки чека)
- **items** — массив товаров/услуг:
  - `description` — название
  - `quantity` — количество
  - `amount` — цена за единицу (рубли)
  - `vat_code` — код НДС:
    - `1` — без НДС
    - `2` — НДС 0%
    - `3` — НДС 10%
    - `4` — НДС 20%
    - `5` — НДС 10/110
    - `6` — НДС 20/120

Для работы чеков необходимо подключить фискализацию в личном кабинете ЮKassa.

## Архитектура

- **Auth**: HTTP Basic Auth (`YOOKASSA_SHOP_ID:YOOKASSA_SECRET_KEY`)
- **Base URL**: `https://api.yookassa.ru/v3/`
- **Idempotence-Key**: UUID v4 в каждом POST-запросе
- **Timeout**: 10 секунд
- **Retry**: 3 попытки на 429/5xx с экспоненциальным backoff (1s, 2s, 4s)
- **Транспорт**: stdio (по умолчанию) или Streamable HTTP (`--http` / `HTTP_PORT`)

## Синергия с dadata-mcp

Проверка контрагента перед оплатой:

```
1. dadata-mcp: find_company_by_id(ИНН) → проверить что компания активна
2. yookassa-mcp: create_payment(amount, description) → получить ссылку на оплату
3. yookassa-mcp: get_payment(id) → проверить статус
```

## Часть серии Russian API MCP

| MCP | Статус | Описание |
|-----|--------|----------|
| [@metarebalance/dadata-mcp](https://github.com/theYahia/dadata-mcp) | готов | Адреса, компании, банки, телефоны |
| [@theyahia/cbr-mcp](https://github.com/theYahia/cbr-mcp) | готов | Курсы валют, ключевая ставка |
| [@theyahia/yookassa-mcp](https://github.com/theYahia/yookassa-mcp) | готов | Платежи, возвраты, чеки 54-ФЗ |
| @theyahia/moysklad-mcp | скоро | Склад, заказы, контрагенты |
| ... | | **+46 серверов** — [полный список](https://github.com/theYahia/russian-mcp) |

## Лицензия

MIT
