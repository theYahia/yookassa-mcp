# @theyahia/yookassa-mcp

MCP-сервер для ЮKassa API — платежи, возвраты, чеки 54-ФЗ. **10 инструментов.** Первый MCP-сервер для ЮKassa.

[![npm](https://img.shields.io/npm/v/@theyahia/yookassa-mcp)](https://www.npmjs.com/package/@theyahia/yookassa-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Часть серии [Russian API MCP](https://github.com/theYahia/russian-mcp) (50 серверов) by [@theYahia](https://github.com/theYahia).

## Установка

### Claude Desktop

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

## Переменные окружения

| Переменная | Обязательна | Описание |
|------------|:-----------:|----------|
| `YOOKASSA_SHOP_ID` | Да | ID магазина (Настройки → Магазин) |
| `YOOKASSA_SECRET_KEY` | Да | Секретный ключ (Интеграция → Ключи API) |

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

### Чеки (1)

| Инструмент | Описание |
|------------|----------|
| `create_receipt` | Кассовый чек 54-ФЗ — товары, НДС, email покупателя |

### Аккаунт (1)

| Инструмент | Описание |
|------------|----------|
| `get_balance` | Статус магазина, тест/продакшн, фискализация |

## Синергия с dadata-mcp

Проверка контрагента перед оплатой:

```
1. dadata-mcp: find_company_by_id(ИНН) → проверить что компания активна
2. yookassa-mcp: create_payment(amount, description) → получить ссылку на оплату
3. yookassa-mcp: get_payment(id) → проверить статус
```

## Примеры запросов

```
Создай платёж на 5000 рублей для заказа #123
```

```
Сделай частичный возврат 2500 рублей по платежу pay_xxx
```

```
Покажи все успешные платежи за последние 7 дней
```

```
Создай чек для платежа pay_xxx, email покупателя test@example.com, товар "Консультация" 5000₽ НДС 20%
```

```
Какой статус моего магазина?
```

## Часть серии Russian API MCP

| MCP | Статус | Описание |
|-----|--------|----------|
| [@metarebalance/dadata-mcp](https://github.com/theYahia/dadata-mcp) | ✅ готов | Адреса, компании, банки, телефоны |
| [@theyahia/cbr-mcp](https://github.com/theYahia/cbr-mcp) | ✅ готов | Курсы валют, ключевая ставка |
| [@theyahia/yookassa-mcp](https://github.com/theYahia/yookassa-mcp) | ✅ готов | Платежи, возвраты, чеки 54-ФЗ |
| @theyahia/moysklad-mcp | 📅 скоро | Склад, заказы, контрагенты |
| ... | 📅 | **+46 серверов** — [полный список](https://github.com/theYahia/russian-mcp) |

## Лицензия

MIT
