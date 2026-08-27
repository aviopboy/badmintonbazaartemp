# Badminton Bazaar

A dark, sporty badminton gear storefront inspired by racketrush.in — with catalog, accounts, cart, and a full admin panel. Catalog preferences remain browser-local (localStorage), while orders are synced through the shared PostgreSQL-backed API so account history is available across devices. Email notifications are sent through formsubmit.co when a customer submits payment proof at checkout.

## Run & Operate

- Workflow: **Badminton Bazaar** — `PORT=26050 BASE_PATH=/ pnpm --filter @workspace/badminton-bazaar run dev`
- Workflow: **API Server** — `PORT=8080 pnpm --filter @workspace/api-server run dev`
- `pnpm --filter @workspace/badminton-bazaar run typecheck` — typecheck the storefront
- `pnpm --filter @workspace/api-server run typecheck` — typecheck the API
- `pnpm run typecheck` — full workspace typecheck

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- React + Vite, Tailwind CSS, lucide-react
- Browser-local state (localStorage) for catalog/preferences, plus an Express/PostgreSQL order service for shared account history
- Drizzle ORM with `@workspace/db` shared library
- No Shopify or other hosted commerce platform

## Where things live

- `artifacts/badminton-bazaar/src/App.tsx` — entire app: storefront, auth, cart, account, admin
- `artifacts/badminton-bazaar/src/index.css` — dark sporty theme
- `artifacts/api-server/src/routes/` — API routes (orders, users, health)
- `lib/db/` — shared Drizzle schema + PostgreSQL connection
- `lib/api-spec/` — OpenAPI spec
- `lib/api-zod/` — generated Zod validators
- `lib/api-client-react/` — generated React Query hooks

## Deployment Architecture

- **Replit** — development environment (this workspace)
- **Vercel Project 1** — API server: https://badmintonbazaar-api-server.vercel.app
  - `DATABASE_URL` set to Neon PostgreSQL in Vercel env vars
- **Vercel Project 2** — Frontend: https://badmintonbazaar-api-frontend.vercel.app
  - `VITE_API_URL` set to `https://badmintonbazaar-api-server.vercel.app` in Vercel env vars
- **Cloudflare Pages** — production storefront on custom domain: https://badmintonbazaar.shop
- **Database** — Neon PostgreSQL (shared between Vercel and Replit dev via `NEON_DATABASE_URL` secret; Replit falls back to `DATABASE_URL` only when the Neon secret is unavailable)

When schema changes are needed: push the schema to Neon using `NEON_DATABASE_URL` (already in Replit Secrets), and notify the user to redeploy Vercel Project 1 to pick up the changes.

When frontend code changes ship: user deploys via Cloudflare Pages / Vercel Project 2. VITE_ variables are baked in at build time — any new env var additions require a redeploy.

## Environment Variables

- `DATABASE_URL` — Replit local PostgreSQL (used in dev)
- `NEON_DATABASE_URL` — Neon PostgreSQL (production database; must be in Replit Secrets — used to push schema changes to Neon)
- `SESSION_SECRET` — session signing secret (already set)
- `VITE_FOUNDER_EMAIL` — founder email for order notifications via formsubmit.co (set in Vercel Project 2 env vars; optional but needed for checkout emails)

## Products (catalog)

Products are now stored in the shared Neon PostgreSQL database (`bb_products` table), not just browser localStorage. When admin adds/edits/deletes a product in the admin panel, it is saved to the DB and immediately visible to all users across all devices.

- On first admin login after migration, any products in the admin's browser localStorage are automatically uploaded to the DB (one-time sync).
- The `bb_products` schema has been pushed to the local dev DB. **NEON_DATABASE_URL must be set in Replit Secrets so the same schema can be pushed to production Neon.**
- To push schema to Neon: `DATABASE_URL=$NEON_DATABASE_URL pnpm --filter @workspace/db run push`

## Accounts

- Admin access is intentionally not displayed in the public storefront
- Any registered user email + password they chose at sign-up

## User preferences

- Keep the brand name **Badminton Bazaar** and logo letter **B**
- Do not use Shopify or any other hosted commerce platform
- Products and users are permanent by default: never auto-delete, truncate, replace, or cap them. Only an explicit, confirmed admin delete may remove a record, and a failed delete must leave the existing record visible.
- There is no product-count limit; every new product with a unique ID must be retained in the shared catalog.
- **Always push fixes to `https://github.com/aviopboy/badmintonbazaartemp` only. Never push changes to the main `badmintonbazaar` repository.**
