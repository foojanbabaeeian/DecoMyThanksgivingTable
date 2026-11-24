-- Harvest Table: shared Thanksgiving tables + thank-you cards.
-- Paste this whole file into Supabase → SQL Editor → Run. It is safe to re-run.
--
-- How access works:
--   * Anyone with a table's link can read it and its cards, and leave a card.
--   * Only the person who created a table (they hold its secret edit_token in
--     their browser) can change the table or remove cards from it.

create extension if not exists pgcrypto;

create table if not exists public.shared_tables (
  id uuid primary key default gen_random_uuid(),
  arrangement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shared_tables add column if not exists host_name text;
alter table public.shared_tables add column if not exists edit_token uuid not null default gen_random_uuid();

create table if not exists public.thank_you_cards (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.shared_tables(id) on delete cascade,
  message text not null,
  sender_name text,
  anonymous boolean not null default true,
  food_asset text,
  created_at timestamptz not null default now()
);
create index if not exists thank_you_cards_table_id_idx on public.thank_you_cards(table_id, created_at);

alter table public.thank_you_cards drop constraint if exists thank_you_cards_message_len;
alter table public.thank_you_cards add constraint thank_you_cards_message_len
  check (char_length(btrim(message)) between 1 and 600) not valid;
alter table public.thank_you_cards drop constraint if exists thank_you_cards_name_len;
alter table public.thank_you_cards add constraint thank_you_cards_name_len
  check (sender_name is null or char_length(sender_name) <= 60) not valid;
alter table public.thank_you_cards drop constraint if exists thank_you_cards_food_len;
alter table public.thank_you_cards add constraint thank_you_cards_food_len
  check (food_asset is null or char_length(food_asset) <= 200) not valid;

alter table public.shared_tables enable row level security;
alter table public.thank_you_cards enable row level security;

-- Policies (dropped first so this script can be re-run).
drop policy if exists "Anyone can read shared tables" on public.shared_tables;
drop policy if exists "Anyone can create shared tables" on public.shared_tables;
drop policy if exists "Anyone can update shared tables" on public.shared_tables;
drop policy if exists "Anyone can read thank-you cards" on public.thank_you_cards;
drop policy if exists "Anyone can send thank-you cards" on public.thank_you_cards;

create policy "Anyone can read shared tables"
  on public.shared_tables for select using (true);
create policy "Anyone can read thank-you cards"
  on public.thank_you_cards for select using (true);
create policy "Anyone can send thank-you cards"
  on public.thank_you_cards for insert with check (true);

-- Never expose edit_token, and route all table writes through the functions below.
revoke all on public.shared_tables from anon, authenticated;
grant select (id, host_name, arrangement, created_at, updated_at) on public.shared_tables to anon, authenticated;
revoke all on public.thank_you_cards from anon, authenticated;
grant select, insert on public.thank_you_cards to anon, authenticated;

create or replace function public.create_table(p_host_name text, p_arrangement jsonb)
returns table (id uuid, edit_token uuid)
language sql
security definer
set search_path = public
as $$
  insert into public.shared_tables (host_name, arrangement)
  values (left(nullif(btrim(p_host_name), ''), 60), coalesce(p_arrangement, '{}'::jsonb))
  returning shared_tables.id, shared_tables.edit_token;
$$;

create or replace function public.update_table(p_id uuid, p_token uuid, p_host_name text, p_arrangement jsonb)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.shared_tables
       set host_name = left(nullif(btrim(p_host_name), ''), 60),
           arrangement = coalesce(p_arrangement, '{}'::jsonb),
           updated_at = now()
     where shared_tables.id = p_id and shared_tables.edit_token = p_token
    returning 1
  )
  select exists (select 1 from updated);
$$;

create or replace function public.delete_card(p_table_id uuid, p_token uuid, p_card_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.thank_you_cards c
     using public.shared_tables t
     where c.id = p_card_id
       and c.table_id = p_table_id
       and t.id = p_table_id
       and t.edit_token = p_token
    returning 1
  )
  select exists (select 1 from deleted);
$$;

revoke all on function public.create_table(text, jsonb) from public;
revoke all on function public.update_table(uuid, uuid, text, jsonb) from public;
revoke all on function public.delete_card(uuid, uuid, uuid) from public;
grant execute on function public.create_table(text, jsonb) to anon, authenticated;
grant execute on function public.update_table(uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.delete_card(uuid, uuid, uuid) to anon, authenticated;
