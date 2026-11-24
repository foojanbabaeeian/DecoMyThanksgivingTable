create extension if not exists pgcrypto;

create table if not exists public.shared_tables (
  id uuid primary key default gen_random_uuid(),
  arrangement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thank_you_cards (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.shared_tables(id) on delete cascade,
  message text not null,
  sender_name text,
  anonymous boolean not null default true,
  food_asset text,
  created_at timestamptz not null default now()
);

alter table public.shared_tables enable row level security;
alter table public.thank_you_cards enable row level security;

create policy "Anyone can read shared tables"
  on public.shared_tables for select using (true);
create policy "Anyone can create shared tables"
  on public.shared_tables for insert with check (true);
create policy "Anyone can update shared tables"
  on public.shared_tables for update using (true) with check (true);

create policy "Anyone can read thank-you cards"
  on public.thank_you_cards for select using (true);
create policy "Anyone can send thank-you cards"
  on public.thank_you_cards for insert with check (true);
