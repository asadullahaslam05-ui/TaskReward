# TaskReward — Production Deployment Guide

## 1. Prerequisites

| Requirement | Details |
|-------------|---------|
| **Supabase project** | A Supabase project with PostgreSQL, Auth, Storage enabled |
| **Vercel account** | Connected to your GitHub repository |
| **Node.js 18+** | For local development |
| **Bun** | Package manager used by this project |

## 2. Required Environment Variables

Set these in your local `.env` (for development) and in Vercel project settings (for production). **Never commit `.env` to git.**

| Variable | Scope | Example | Purpose |
|----------|-------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://YOUR-PROJECT-REF.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_...` | Supabase anon/publishable key (respects RLS) |
| `SUPABASE_SECRET_KEY` | **Server-only** | `sb_secret_...` | Supabase service-role key (bypasses RLS — never expose to browser) |
| `DATABASE_URL` | Server-only (legacy) | `file:./db/custom.db` | Legacy Prisma/SQLite (deprecated routes only) |

### Where to find Supabase credentials
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Settings** → **API**
3. Copy the **Project URL**, **publishable (anon) key**, and **secret (service_role) key**

## 3. Local Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/taskreward.git
cd taskreward

# Install dependencies
bun install

# Generate Prisma client (for legacy routes)
bun run db:generate

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
bun run dev
```

## 4. .env Configuration

The `.env` file must contain all 3 Supabase variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_key
DATABASE_URL=file:./db/custom.db
```

**Security rules:**
- ✅ `NEXT_PUBLIC_*` variables are safe for the browser (they respect RLS)
- ❌ `SUPABASE_SECRET_KEY` must NEVER be prefixed with `NEXT_PUBLIC_`
- ❌ Never commit `.env` or any file containing real keys
- ✅ `.env.example` contains only placeholders — safe to commit

## 5. Supabase Database Setup

### Run migrations
Execute the SQL migration files in order using the Supabase SQL Editor (Dashboard → SQL Editor):

1. `supabase/migrations/001_initial_schema.sql` — Creates all tables, enums, indexes, triggers
2. `supabase/migrations/002_rls_policies.sql` — Enables Row-Level Security on all tables
3. `supabase/migrations/003_rpc_functions.sql` — Creates atomic financial RPC functions (SECURITY DEFINER)
4. `supabase/migrations/004_storage.sql` — Creates storage buckets + storage RLS policies
5. `supabase/migrations/005_seed_data.sql` — Seeds default settings, payment methods, membership plans

### Verify database
After running migrations, verify:
- 35 tables exist (profiles, wallets, tasks, registration_payments, etc.)
- RLS is enabled on all tables
- 8 RPC functions exist (approve_registration_payment, approve_task_submission, etc.)
- 5 storage buckets exist (payment-proofs, task-proofs, payout-proofs, profile-images, site-assets)
- Default site_settings (55 rows) and payment methods (Easypaisa, JazzCash, Binance) are seeded

## 6. Supabase Auth URL Configuration

In Supabase Dashboard → **Authentication** → **URL Configuration**:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://YOUR-VERCEL-DOMAIN.vercel.app` |
| **Redirect URLs** | `https://YOUR-VERCEL-DOMAIN.vercel.app/**` |

For local development, also add: `http://localhost:3000/**`

## 7. Storage Requirements

The following private buckets must exist (created by `004_storage.sql`):

| Bucket | Public | Purpose | Access |
|--------|--------|---------|--------|
| `payment-proofs` | ❌ Private | Registration payment screenshots | User uploads to own folder; admin reads via signed URL |
| `task-proofs` | ❌ Private | Task completion screenshots | User uploads to own folder; admin reads via signed URL |
| `payout-proofs` | ❌ Private | Withdrawal payout proofs | Admin-only upload + read |
| `profile-images` | ✅ Public | User avatars | User uploads to own folder; public read |
| `site-assets` | ✅ Public | CMS images, logos | Admin-only upload; public read |

## 8. GitHub Deployment

```bash
git init
git add .
git commit -m "Initial commit: TaskReward production"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/taskreward.git
git push -u origin main
```

## 9. Vercel Deployment

1. Push your repository to GitHub
2. In Vercel, create a new project from the GitHub repo
3. Framework preset: **Next.js**
4. Build command: `bun run build` (or `next build`)
5. Output directory: `.next` (auto-detected)
6. Install command: `bun install` (or `npm install`)
7. Add all 4 environment variables in Vercel → **Settings** → **Environment Variables**
8. Click **Deploy**

## 10. Production Smoke Testing

After deployment, run these tests against the production URL:

### Anonymous user
- [ ] Homepage loads (HTTP 200)
- [ ] Login page opens
- [ ] Signup page opens
- [ ] No console errors

### Authentication
- [ ] Signup creates a PAYMENT_PENDING user
- [ ] Login as SUPER_ADMIN works
- [ ] Session persists across page reload
- [ ] Logout works

### Paid registration
- [ ] Payment page shows real fee from DB
- [ ] Payment methods load from DB
- [ ] Screenshot upload works
- [ ] Payment submission creates PENDING record
- [ ] Admin approval activates user + creates membership

### Tasks
- [ ] Active user sees available tasks
- [ ] Task submission with proof upload works
- [ ] One-task-one-time enforced
- [ ] Admin approval credits reward to wallet

### Admin panel
- [ ] Dashboard analytics show real data
- [ ] Review Queues show pending counts
- [ ] Data Integrity shows 0 critical issues
- [ ] System Health shows all services healthy
- [ ] All admin pages load without errors

## 11. Troubleshooting

### "supabaseUrl is required"
→ Environment variables are missing. Verify all 3 Supabase vars are set.

### "Failed to fetch" on upload
→ The upload route requires authentication. Ensure the user is logged in and storage buckets exist.

### Build fails with Prisma error
→ Run `bun run db:generate` to generate the Prisma client before building.

### Hydration errors
→ Ensure Skeleton components (which render `<div>`) are not placed inside `<p>` elements.
