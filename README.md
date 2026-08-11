# Presoft Dashboard Platform

A Next.js dashboard (revenue, monthly trends, performance breakdowns, item catalog) over the AutoCount/Presoft SQL Server account book. This repo has no database credentials and no direct database access of its own for live data — it's a client of a separate service, **presoft-api**, which owns the real SQL Server connection.

## How it fits together

```
Browser  ──>  This app (Next.js, :3000)  ──>  presoft-api (Express, separate repo, :4000)  ──>  SQL Server
```

The browser only ever talks to **this app's own server** — never to presoft-api directly. Two server-side proxy points make that true:

- `app/api/presoft/[name]/route.ts` — forwards data requests (`GET /api/presoft/get_kpi_summary_v2`, etc.) to presoft-api's REST endpoints, attaching a shared API key
- `app/api/auth/login/route.ts` — forwards login credentials to presoft-api's `/api/v1/auth/login`, then sets the JWT it returns as an httpOnly cookie on this app's own origin

This exists specifically so two secrets never reach the browser bundle: the **presoft-api API key** and the **session JWT**.

## Prerequisites

- Node.js 20+
- A running **presoft-api** instance, already connected to a SQL Server account book (via its own `/setup` page) with at least one login seeded (`npm run seed:admin` in that repo)

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Var | Description |
| --- | --- |
| `PRESOFT_API_URL` | Where presoft-api is running, e.g. `http://localhost:4000` |
| `PRESOFT_API_KEY` | Must match presoft-api's own `API_KEY` exactly |
| `JWT_SECRET` | Must match presoft-api's own `JWT_SECRET` exactly (verifies the login session) |

None of these are `NEXT_PUBLIC_`-prefixed on purpose — that prefix inlines a value into the client bundle, which would defeat the point of keeping them server-only.

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`. Log in with a user created via presoft-api's `npm run seed:admin -- <userId> <email> <password> [displayName] [role]`.

## How login works

1. Login form posts to this app's own `POST /api/auth/login`
2. That route forwards the credentials to presoft-api's `POST /api/v1/auth/login` (with the API key attached), which checks them against `PosDashboardUser` and returns a signed JWT
3. This app sets that JWT as an httpOnly `session` cookie on its own origin — the browser never sees the raw token
4. `proxy.ts` verifies the cookie's JWT on every request and redirects to `/login` if it's missing/invalid
5. `GET /api/auth/me` decodes the cookie server-side so client components (the sidebar) can show the current user's name/role
6. `POST /api/auth/logout` clears the cookie

Auth-mode note: presoft-api's SQL Server driver can only use one auth mode (Windows or SQL login) per running process — if you change it via presoft-api's `/setup` page, presoft-api needs a restart, not just this app.

## How data fetching works

Every dashboard page still calls `createClient().rpc(name, params)` (`lib/db/client.ts`) — a shape kept intentionally close to the old Supabase-backed version so page code didn't need to change through the migration. Under the hood:

1. `lib/db/client.ts` fetches this app's own `GET /api/presoft/[name]`
2. `app/api/presoft/[name]/route.ts` maps that RPC name to presoft-api's real REST path, attaches the API key, and forwards the request
3. presoft-api queries SQL Server and returns JSON, which flows back through the same chain

## Project structure

```
app/
  (dashboard)/            main pages — overview, monthly, performance, item
  login/                  login page
  api/auth/               login, logout, me route handlers (session cookie)
  api/presoft/[name]/     server-side proxy to presoft-api (data)
  api/rpc/[name]/         internal direct-to-SQL-Server test route — see below
  api/test/               ad-hoc data-integrity check routes, same caveat
  api-docs/               Swagger UI for the internal /api/rpc dispatcher
lib/
  auth/jwt.ts             session cookie JWT verify (SessionUser, SESSION_COOKIE)
  presoft-api.ts           shared PRESOFT_API_URL + API key header helper
  db/client.ts            rpc() shim — calls this app's own /api/presoft/*
  db/registry.ts,
  db/queries/*, mssql.ts  direct SQL Server access, used only by /api/rpc and /api/test
proxy.ts                  session-cookie auth gate (excludes /login, /api)
components/sidebar.tsx    nav + account block, reads /api/auth/me
```

## Known loose ends

- `app/api/rpc/[name]`, `app/api/test/*`, and `app/(dashboard)/test` are an internal, direct-to-SQL-Server path kept for ad-hoc verification during the migration off Supabase — not on the live data path (that's presoft-api now) and safe to delete once you're confident presoft-api's numbers are correct.
- The login page's "Forgot your password?" link points at `/forgot-password`, which has no route yet.
- presoft-api's data endpoints (`/api/v1/*` besides `/setup`) are gated by a shared API key, not per-user auth — anyone with the key can call them, so treat the key like a password.
