# ShopVerse Server

Express + TypeScript + Prisma (SQLite) REST API for the ShopVerse e-commerce platform.
Serves the public storefront endpoints, the RBAC-protected admin dashboard API, and hosts the built admin dashboard (Vite app) in production.

## Tech stack

- Node.js 20+ (built on Node 24), TypeScript, Express 4
- Prisma 6 + SQLite (no external database required)
- Zod (validation), bcryptjs (passwords), jsonwebtoken (access tokens)
- Opague (DB-backed) single-use refresh tokens with rotation
- RBAC: 4 built-in roles × 12 permission keys
- swagger-ui-express (API docs at `/docs`), vitest + supertest (tests)

## Quick start

```bash
# install + prepare DB
npm install
npx prisma migrate deploy        # or: npx prisma db push
npx tsx prisma/seed.ts           # creates super admin + demo catalog

# run in development (with .env)
npx tsx src/index.ts             # -> http://localhost:5000
```

Environment variables (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port |
| `DATABASE_URL` | `file:./dev.db` | SQLite file |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `JWT_ACCESS_SECRET` | dev value **change in prod** | HS256 signing secret for access tokens |
| `JWT_REFRESH_SECRET` | dev value **change in prod** | Seeds refresh-token derivation |
| `JWT_ACCESS_EXPIRES` | `60m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token lifetime |
| `UPLOAD_DIR` | `uploads` | Product image uploads |
| `MAX_UPLOAD_MB` | `5` | Image upload size cap |

The seed script accepts `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` to override the default super admin.

## Default accounts

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | `superadmin@shopverse.pk` | `ShopVerse@2026` |

Change these via `ADMIN_EMAIL`/`ADMIN_PASSWORD` before running the seed in production.

## Roles & permissions

Roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF` (see `src/lib/prisma.ts`).

Permission keys: `dashboard, products, categories, brands, inventory, orders, customers, discounts, taxes, reports, admins, settings`.

- `SUPER_ADMIN` / `ADMIN` → all permissions.
- `MANAGER` → everything except `admins` and `settings`.
- `STAFF` → `dashboard, products, inventory, orders, customers`.
- `SUPER_ADMIN` bypasses all `authorize()` checks (guards apply to others).

## Scripts

```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc -> dist/
npm start            # node dist/index.js
npm run test         # vitest run (27 integration tests on a throwaway test.db)
npm run typecheck    # tsc --noEmit
```

Tests use a dedicated database (`file:./test.db`, recreated via `prisma db push --force-reset` in `test/globalSetup.ts`) so your dev data is never touched.

## API overview

Interactive docs are served at **`/docs`** when the server is running.

Conventions:

- Response envelope: `{ "success": true, "message": "...", "data": ... }`.
- Errors: `{ "success": false, "message": "..." }` — 400/401/403/404/409/422.
- Pagination: query `page` + `pageSize`; responses include `items, total, page, pageSize, totalPages`.
- Admin auth: `Authorization: Bearer <accessToken>` (JWT). Storefront endpoints are public.

### Auth (`/api/auth/*`)
`login` → returns `{ accessToken, refreshToken, admin, permissions[] }`.
`refresh` rotates the opaque refresh token (old one is revoked). `me`, `logout`,
`forgot-password` (dev returns the token in the response), `reset-password`, `change-password`.

### Storefront (`/api/store/*`)
`GET /products` (search + paging, active only), `GET /products/:slug`,
`GET /categories`, `GET /brands`, `GET /settings` (public keys only),
cart (`/api/store/cart`) and `POST /api/store/orders` (checkout).

Order payload:

```json
{
  "items": [{ "productId": "…", "qty": 2 }],
  "customer": { "name": "Ali Khan", "email": "ali@gmail.com", "phone": "…" },
  "address": { "fullName": "…", "phone": "…", "line1": "…", "city": "…" },
  "couponCode": "SAVE10",
  "paymentMethod": "COD"
}
```

`address.fullName`, `address.line1`, `address.city` all need ≥2 characters and
`phone` ≥7 characters. The server resolves or creates a customer by email, applies
tax/coupons, decrements stock, and returns the order with a `SV-YYYY-######` number.
`GET /api/store/orders/track/:orderNumber` is public tracking.

### Admin (`/api/admin/*`)
`products`, `categories`, `brands`, `tax-rules`, `inventory` (+ `/low-stock`),
`coupons`, `orders` (+ `/:id/status`, `/:id/payments`), `customers`
(+ `/:id/status`), `settings`, `admins` (+ `/roles`, `/permissions`),
`reports` (`/summary`, `/revenue`, `/top-products`, `/stock-value`), `audit-logs`.

Cancelling an order (`PATCH /api/admin/orders/:id/status` with `CANCELLED`) restores stock.

## Production

```bash
npm --workspace server run build        # compile server
npm --workspace dashboard run build     # build dashboard -> dashboard/dist
npm --workspace server start            # serves API + dashboard SPA at :5000
```

The server serves `../dashboard/dist` with an SPA fallback (excluding `/api`, `/uploads`, `/health`, `/docs`).

## Project layout

```
src/
  index.ts              # bootstrap (dotenv, listen)
  app.ts                # express app: security, CORS, routes, dashboard static, /docs
  env.ts                # typed environment config
  lib/prisma.ts         # Prisma client, roles, permission keys, order/status enums
  middleware/           # auth (JWT+RBAC), validation (zod), error handling, rate limit
  modules/              # feature folders (routes + service + schema + tests)
  docs/swagger.ts       # OpenAPI 3.1 spec
test/                   # vitest + supertest integration suites
prisma/schema.prisma    # data model
prisma/seed.ts          # super admin + demo catalog/settings
```