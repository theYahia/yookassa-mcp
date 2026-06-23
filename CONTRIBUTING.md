# Contributing

Thanks for helping improve `@theyahia/yookassa-mcp`.

## Development

```bash
npm ci          # install dependencies
npm run lint    # Biome linter (must pass; stdout must stay clean for stdio)
npm run build   # tsc -> dist/
npm test        # Vitest (mocked fetch; no network)
```

CI runs lint → build → test on Node 18, 20, and 22. All three must pass.

## Testing against a sandbox

Tests mock `fetch` and never hit the network. To try the server end-to-end, use **test-shop**
credentials from the [YooKassa dashboard](https://yookassa.ru/my/shop-settings):

```bash
YOOKASSA_SHOP_ID=<test-id> YOOKASSA_SECRET_KEY=<test-key> npm run dev
```

Verify you are in test mode by calling `get_shop_info` (expect `test: true`) **before** pointing
the server at a live shop. `create_payment` / `create_refund` / `create_payout` act on **real
funds** in a live shop.

## Conventions

- Keep `stdout` free of logs (stdio transport carries JSON-RPC there) — use `console.error`.
- Money goes through `formatAmount`/`toKopecks` (integer kopecks), never raw float `toFixed`.
- POST/DELETE requests must carry a stable `Idempotence-Key` (handled by the client).
- Add/extend tests for any behaviour change; bundled skills must reference real tool names
  (enforced by `tests/skills.test.ts`).
- Tool descriptions and field hints are in English.

## Releasing

Bump the version in `package.json` (the server and `/health` read it), update `CHANGELOG.md`,
then tag `vX.Y.Z`. Publishing to npm is done by the maintainer.
