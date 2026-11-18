-- Execute UMA VEZ no SQL Editor do projeto Supabase existente.
-- Fotos públicas para que os participantes possam ver o ranking.
alter table public.players add column if not exists foto_path text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('player-photos','player-photos',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Jogador envia a propria foto" on storage.objects for insert to authenticated
with check(bucket_id='player-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Jogador atualiza a propria foto" on storage.objects for update to authenticated
using(bucket_id='player-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='player-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Bloqueia apontar perfil para arquivo de outro jogador.
create or replace function public.protect_player_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_papangu_admin() then
   if new.estrelas is distinct from old.estrelas or new.role is distinct from old.role or new.id is distinct from old.id then
     raise exception 'Somente administradores podem alterar estrelas e permissoes';
   end if;
 end if;
 if new.foto_path is distinct from old.foto_path and new.foto_path is not null
    and split_part(new.foto_path,'/',1) <> new.id::text then
   raise exception 'Foto deve pertencer ao jogador';
 end if;
 return new;
end; $$;
