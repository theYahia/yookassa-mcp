# @theyahia/yookassa-mcp

MCP server for YooKassa API -- payments, refunds, receipts (54-FZ), payouts, webhooks, recurring, SBP, marketplace splits. **20 tools.**

[![npm](https://img.shields.io/npm/v/@theyahia/yookassa-mcp)](https://www.npmjs.com/package/@theyahia/yookassa-mcp)
[![CI](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/theYahia/yookassa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@theyahia/yookassa-mcp)](https://smithery.ai/server/@theyahia/yookassa-mcp)

Part of [Russian API MCP](https://github.com/theYahia/russian-mcp) series by [@theYahia](https://github.com/theYahia).

## Quick Start

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

### Streamable HTTP (remote / Docker)

```bash
HTTP_PORT=3000 npx -y @theyahia/yookassa-mcp --http
```

Endpoints:
- `POST /mcp` -- MCP Streamable HTTP transport
- `GET /health` -- health check (`{ "status": "ok", "tools": 20 }`)

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `YOOKASSA_SHOP_ID` | Yes | Shop ID (Settings -> Shop) |
| `YOOKASSA_SECRET_KEY` | Yes | Secret key (Integration -> API Keys) |
| `HTTP_PORT` | No | Port for HTTP transport (default 3000) |

For testing, create a demo shop in [YooKassa dashboard](https://yookassa.ru/my/shop-settings).

## Tools (20)

### Payments (9)

| Tool | Description |
|------|-------------|
| `create_payment` | Create a payment with amount, description, payment method. Returns payment URL. Supports receipts and metadata |
| `get_payment` | Get payment details by ID -- status, amount, confirmation URL, metadata |
| `capture_payment` | Confirm a two-step payment (capture held funds). Partial capture supported |
| `cancel_payment` | Cancel a payment (pending or waiting_for_capture) |
| `list_payments` | List payments with filters by status, date range, and pagination |
| `save_payment_method` | Save a payment method for recurring charges (card binding) |
| `create_recurring_payment` | Charge a saved payment method (no user interaction) |
| `create_sbp_payment` | Create a payment via SBP (Russian fast payment system) |
| `create_split_payment` | Split payment for marketplaces -- distribute funds among partners |

### Refunds (3)

| Tool | Description |
|------|-------------|
| `create_refund` | Full or partial refund by payment ID |
| `get_refund` | Get refund details by ID |
| `list_refunds` | List refunds with optional payment filter |

### Receipts (2)

| Tool | Description |
|------|-------------|
| `create_receipt` | Fiscal receipt (54-FZ) -- items, VAT codes, customer contacts |
| `list_receipts` | List receipts by payment or refund ID |

### Payouts (2)

| Tool | Description |
|------|-------------|
| `create_payout` | Payout to bank card, YooMoney wallet, or SBP phone |
| `get_payout` | Get payout status and details by ID |

### Webhooks (3)

| Tool | Description |
|------|-------------|
| `create_webhook` | Register a webhook URL for events (payment.succeeded, refund.succeeded, etc.) |
| `list_webhooks` | List all registered webhooks |
| `delete_webhook` | Delete a webhook by ID |

### Account (1)

| Tool | Description |
|------|-------------|
| `get_shop_balance` | Shop info -- ID, status, test mode, fiscalization |

## Demo Prompts

```
Create a payment for 5000 RUB for order #123 with SBP as payment method
```

```
Set up a recurring subscription: bind the card with 1 ruble, then charge 999 RUB monthly using the saved method
```

```
Show all successful payments for the last 7 days and create a refund of 2500 RUB for payment pay_xxx
```

## Architecture

- **Auth**: HTTP Basic Auth (`YOOKASSA_SHOP_ID:YOOKASSA_SECRET_KEY`)
- **Base URL**: `https://api.yookassa.ru/v3/`
- **Idempotence-Key**: UUID v4 on every POST request
- **Timeout**: 10 seconds
- **Retry**: 3 attempts on 429/5xx with exponential backoff (1s, 2s, 4s)
- **Transport**: stdio (default) or Streamable HTTP (`--http` / `HTTP_PORT`)

## Part of Russian API MCP Series

| MCP | Status | Description |
|-----|--------|-------------|
| [@metarebalance/dadata-mcp](https://github.com/theYahia/dadata-mcp) | ready | Addresses, companies, banks, phones |
| [@theyahia/cbr-mcp](https://github.com/theYahia/cbr-mcp) | ready | Currency rates, key rate |
| [@theyahia/yookassa-mcp](https://github.com/theYahia/yookassa-mcp) | ready | Payments, refunds, receipts, payouts, webhooks |
| [@theyahia/cloudpayments-mcp](https://github.com/theYahia/cloudpayments-mcp) | ready | Payments, subscriptions, orders |
| ... | | **+46 servers** -- [full list](https://github.com/theYahia/russian-mcp) |

## License

MIT
