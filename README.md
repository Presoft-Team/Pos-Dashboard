# Presoft Dashboard Platform

A Next.js dashboard (revenue, monthly trends, performance breakdowns, purchases, item catalog) over the AutoCount/Presoft SQL Server account book.

This repo has **no database access of its own**. Every byte of data comes over HTTP from **autocount-write-service** (sibling repo), which owns the SQL Server connection and does the reporting aggregation in SQL.

## How it fits together

```
Browser  ──>  This app (Next.js, :3000)  ──>  autocount-write-service (:8099)  ──>  SQL Server
```

The browser only ever talks to **this app's own server** — never to the service directly. `app/api/presoft/[name]/route.ts` maps each dashboard request (`GET /api/presoft/get_kpi_summary_v2`, etc.) onto the service's `api/reports/*` endpoints, attaching the shared API key server-side.

That indirection exists for one reason: so the **API key never reaches the browser bundle**.

**The aggregation lives in the service, not here.** Revenue, purchases, monthly trends and every breakdown are computed in SQL against the account book (see that repo's `Controllers/ReportsController.cs`); this app only reshapes the JSON into the row types its pages expect. An earlier version pulled every document over HTTP and summed them in Node — far slower, and blind to documents the API didn't expose.

## Prerequisites

- Node.js 20+
- A running **autocount-write-service**, already pointed at an account book via its own `/setup` page, reachable from the machine running this app

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Var | Description |
| --- | --- |
| `PRESOFT_API_URL` | Where autocount-write-service listens, e.g. `http://localhost:8099`. The `http://` is added for you if omitted. |
| `PRESOFT_API_KEY` | Must match the service's `ApiKey` in its `deployment-settings.json` exactly — sent as `x-api-key` |

There is no company/account-book setting here: the service is bound to one book by its own `connection-config.json`, chosen on its `/setup` page.

None of these are `NEXT_PUBLIC_`-prefixed on purpose: that prefix inlines a value into the client bundle, defeating the point of keeping the key server-only.

Next reads env files **once at startup** — editing one while `npm run dev` is running has no effect until you fully stop and restart it.

```bash
npm run dev
```

Visit `http://localhost:3000`. There is no login; the dashboard loads straight to data.

## No authentication

This app has no users, sessions, or login page. Anyone who can reach it gets the full dashboard, and presoft-api's own endpoints are gated by a shared API key rather than per-user auth. **Don't expose either service to an untrusted network as-is.**

## How data fetching works

Every dashboard page calls `createClient().rpc(name, params)` (`lib/db/client.ts`). Under the hood:

1. `lib/db/client.ts` fetches this app's own `GET /api/presoft/[name]`
2. `app/api/presoft/[name]/route.ts` maps that RPC name to an `api/reports/*` endpoint on the service, attaches the API key, and reshapes the response
3. the service aggregates in SQL and returns JSON, which flows back through the same chain

### What the numbers mean

Two rules decided in the service, worth knowing when reading the dashboard:

- **Revenue** is `ARInvoice + ARDebitNote − ARCreditNote` (ledger) unioned with `Invoice + CashSale + DebitNote − CreditNote` (stock), counting only detail lines whose account is in the revenue range. **Purchase** is the AP/PI equivalent.
- A sale exists twice — as a stock document *and* the AR ledger row it posts to, sharing a DocNo. They are **de-duplicated**: money from the ledger view, items and quantity from the stock view. Only the stock view has `ItemCode`/`Qty`, so a ledger-only document contributes to the KPI but not to Best Sellers or the Item breakdown, and those can legitimately total less than total revenue.

Quantity therefore appears only on item-sourced tables. Sales Agent, Debtor, Creditor and Monthly are amount-only, because AR/AP headers carry no quantity at all.

## Checking the connection

`/test` (not linked from nav) is a smoke test for the whole chain:

- **API Connection** reads the service's OpenAPI spec and lists every endpoint it advertises. On failure it names the stage — config missing, host unreachable, HTTP error, or "answered but not with JSON" (usually the URL points somewhere else entirely).
- **Call an endpoint** calls any path on the service and shows status, latency, row count, and raw JSON.

If a probe returns rows, the dashboard pages will work — they use the identical path.

## Project structure

```
app/
  (dashboard)/            main pages — overview, monthly, performance, purchase, item
  (dashboard)/test/       connection smoke test (see above)
  api/presoft/[name]/     server-side proxy to the reports service (data)
  api/presoft/items/…     binary passthrough for item images
  api/test/connection/    reads presoft-api's /docs.json, reports failure stage
  api/test/probe/         calls one arbitrary presoft-api path
  api/test/credit-paid/   \ hookups for presoft-api endpoints that don't
  api/test/join-integrity/ / exist yet — see Known loose ends
  api/openapi.json/       proxies presoft-api's own spec
  api-docs/               Swagger UI over that spec
lib/
  presoft-api.ts          PRESOFT_API_URL/KEY resolution + apiFetch() helper
  db/client.ts            rpc() shim — calls this app's own /api/presoft/*
  filters.ts              Filters -> query params
  filter-context.tsx      shared filter/groupBy state across pages
  currency.ts             per-currency money formatting + chart pivoting
  export.tsx              column specs for the PNG/PDF export modal
components/sidebar.tsx    nav
types/index.ts            row shapes returned by presoft-api
```

## Known loose ends

- `/api/test/credit-paid` and `/api/test/join-integrity` are dashboard-side hookups for `/api/v1/test/*` endpoints that **don't exist on the service**. Nothing calls them; they'll 404 until that side is built.
- **Which accounts count as revenue/purchase is still provisional.** The service currently takes every account in the 5xxx range as revenue and 6xxx as purchase. That sweeps in contra accounts (`DISCOUNT ALLOWED` adds to revenue instead of reducing it) and misses credit notes posted outside those ranges. Pending a decision on an explicit account map.
- The Location filter exists only on the Item page; it was removed from the shared filter bar and from the Performance/Purchase breakdowns.
- No authentication, as above.
