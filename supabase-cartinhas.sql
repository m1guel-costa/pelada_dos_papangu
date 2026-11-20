-- Execute uma vez no Supabase SQL Editor.
-- Cartinhas separadas das estrelas; nenhuma estatistica inventada.
create table if not exists public.player_cards (
 player_id uuid primary key references public.players(id) on delete cascade,
 vel smallint check (vel between 1 and 99),
 chu smallint check (chu between 1 and 99),
 pas smallint check (pas between 1 and 99),
 dri smallint check (dri between 1 and 99),
 def smallint check (def between 1 and 99),
 fis smallint check (fis between 1 and 99),
 updated_at timestamptz not null default now()
);
alter table public.player_cards enable row level security;
drop policy if exists "Mensalistas visualizam cartinhas" on public.player_cards;
create policy "Mensalistas visualizam cartinhas" on public.player_cards for select to authenticated using (true);
drop policy if exists "Admins criam cartinhas" on public.player_cards;
create policy "Admins criam cartinhas" on public.player_cards for insert to authenticated with check (public.is_papangu_admin());
drop policy if exists "Admins atualizam cartinhas" on public.player_cards;
create policy "Admins atualizam cartinhas" on public.player_cards for update to authenticated using (public.is_papangu_admin()) with check (public.is_papangu_admin());
