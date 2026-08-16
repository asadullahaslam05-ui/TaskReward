# TaskReward

A production-ready online earning/task reward platform built with Next.js 16, Supabase, and TypeScript. Users complete tasks (TikTok likes, follows, comments) and earn real money via Easypaisa, JazzCash, and Binance payouts.

## Features

- **Paid Registration** — Users pay a registration fee (admin-configured) and get approved by admin
- **Membership System** — Monthly membership with activation, renewal, expiry
- **Task System** — Admin-created tasks with proof submission, one-task-one-time enforcement, reward crediting
- **Wallet** — Real-time balance, pending balance, transaction ledger
- **Withdrawals** — Minimum/maximum/daily limits, admin approval workflow
- **Admin Panel** — 28+ sections: dashboard analytics, review queues, user management, payment review, task management, withdrawals, settings, audit logs, data integrity, system health
- **Supabase Auth** — Secure authentication with RLS-protected database
- **Storage** — Private proof files with signed URLs

## Requirements

- Node.js 18+
- Bun (recommended) or npm
- A Supabase project (free tier works)

## Install

```bash
bun install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | ✅ | Supabase anon key (respects RLS) |
| `SUPABASE_SECRET_KEY` | Server-only | ✅ | Service-role key (bypasses RLS) |
| `DATABASE_URL` | Server | Optional | Legacy Prisma (deprecated routes) |

## Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
bun run build
```

## Supabase Setup

Run the migration SQL files in order in the Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_rpc_functions.sql`
4. `supabase/migrations/004_storage.sql`
5. `supabase/migrations/005_seed_data.sql`

## GitHub Deployment

```bash
git init
git add .
git commit -m "Initial commit: TaskReward production"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/taskreward.git
git push -u origin main
```

## Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and import your GitHub repository
2. Framework preset: **Next.js** (auto-detected)
3. Add environment variables in Vercel → Settings → Environment Variables
4. Click **Deploy**

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Security Notes

- **Never commit `.env`** — it contains your Supabase service-role key
- The service-role key bypasses RLS — keep it server-only
- All user financial operations are atomic (PostgreSQL RPC functions with `FOR UPDATE` locking)
- Private proof files are accessed via short-lived signed URLs (10-minute expiry)
- User activation requires an approved registration payment (business rule enforced server-side)

## Project Structure

```
TaskReward/
├── src/
│   ├── app/                 # Next.js App Router pages + API routes
│   │   ├── api/supabase/    # Supabase API routes (auth, admin, user)
│   │   ├── page.tsx         # Main SPA entry
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components (admin, user, public, shared, ui)
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Shared libraries (supabase clients, env, api utils)
│   └── stores/              # Zustand stores
├── public/
│   └── branding/            # Logo + favicon assets
├── supabase/
│   └── migrations/          # 5 SQL migration files
├── .env.example             # Environment template (no real secrets)
├── .gitignore
├── DEPLOYMENT.md            # Complete deployment guide
├── package.json
└── bun.lock
```

## License

Private — All rights reserved.
