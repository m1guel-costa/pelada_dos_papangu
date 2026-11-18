-- Execute no SQL Editor de um projeto Supabase NOVO.
create table if not exists public.players (
 id uuid primary key references auth.users(id) on delete cascade,
 nome text not null check (char_length(nome) between 2 and 100),
 apelido text not null default '',
 posicao text not null default 'Não definida' check (posicao in ('Não definida','Goleiro','Defensor','Meio-campo','Atacante')),
 estrelas integer not null default 3 check (estrelas between 1 and 5),
 role text not null default 'player' check (role in ('player','admin')),
 created_at timestamptz not null default now()
);
alter table public.players enable row level security;
create or replace function public.is_papangu_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.players where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_papangu_admin() from public;
grant execute on function public.is_papangu_admin() to authenticated;
create policy "Jogadores autenticados podem ver ranking" on public.players
for select to authenticated using (true);
create policy "Jogador edita perfil ou admin edita jogadores" on public.players
for update to authenticated using (id = (select auth.uid()) or public.is_papangu_admin())
with check (id = (select auth.uid()) or public.is_papangu_admin());
-- Impede elevação de privilégios e alteração de estrelas mesmo via API.
create or replace function public.protect_player_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_papangu_admin() then
   if new.estrelas is distinct from old.estrelas or new.role is distinct from old.role or new.id is distinct from old.id then
     raise exception 'Somente administradores podem alterar estrelas e permissões';
   end if;
 end if;
 return new;
end; $$;
create trigger protect_player_fields_before_update
before update on public.players for each row execute function public.protect_player_fields();
-- Perfil criado automaticamente quando alguém registra conta.
create or replace function public.create_player_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.players(id,nome,apelido,posicao)
 values(new.id,
   coalesce(nullif(left(trim(new.raw_user_meta_data->>'nome'),100),''),'Jogador'),
   left(coalesce(new.raw_user_meta_data->>'apelido',''),100),
   case when new.raw_user_meta_data->>'posicao' in ('Goleiro','Defensor','Meio-campo','Atacante')
     then new.raw_user_meta_data->>'posicao' else 'Não definida' end);
 return new;
end; $$;
create trigger create_player_after_signup after insert on auth.users
for each row execute function public.create_player_on_signup();
-- Após criar sua própria conta, substitua o UUID abaixo pelo ID dela (Authentication > Users).
-- UPDATE public.players SET role = 'admin' WHERE id = 'COLE-SEU-UUID-AQUI';
