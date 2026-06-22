-- Physical poster fulfillment via Gelato
-- Adds poster_orders to track pay-per-order physical prints alongside the
-- existing subscription/download model.

create type public.order_status as enum (
  'created',
  'paid',
  'submitting',
  'submitted',
  'in_production',
  'shipped',
  'delivered',
  'failed',
  'cancelled'
);

create table public.poster_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid references public.poster_jobs(id),
  config jsonb not null,
  config_hash text not null,

  -- product selection
  size_key text not null,
  product_uid text not null,
  quantity integer not null default 1 check (quantity >= 1),

  -- shipping address
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  post_code text not null,
  country text not null,

  -- pricing snapshot (taken at order creation)
  currency text not null default 'USD',
  amount_total numeric(10,2),
  amount_product numeric(10,2),
  amount_shipping numeric(10,2),
  markup numeric(6,3),

  -- payment
  stripe_checkout_session_id text unique,
  stripe_payment_intent text,

  -- fulfillment
  gelato_order_id text,
  gelato_order_reference_id text unique,
  status public.order_status not null default 'created',
  tracking_url text,
  error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.poster_orders enable row level security;

create policy "Users can view own orders"
  on public.poster_orders for select using (auth.uid() = user_id);

create policy "Users can insert own orders"
  on public.poster_orders for insert with check (auth.uid() = user_id);

-- Note: server-side reads/writes use the service-role admin client, which
-- bypasses RLS. We intentionally do NOT add a permissive "USING (true)" ALL
-- policy here (it would grant every authenticated user full access and trips
-- the rls_policy_always_true linter). The user-scoped policies above are enough.

create index idx_poster_orders_user on public.poster_orders(user_id);
create index idx_poster_orders_status on public.poster_orders(status);
create index idx_poster_orders_job on public.poster_orders(job_id);
