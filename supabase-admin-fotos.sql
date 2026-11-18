-- Execute no SQL Editor do Supabase para permitir que administradores alterem fotos de mensalistas.
-- Mantem jogadores comuns restritos a suas proprias pastas.
drop policy if exists "Administrador envia foto de mensalista" on storage.objects;
create policy "Administrador envia foto de mensalista"
on storage.objects for insert to authenticated
with check (bucket_id = 'player-photos' and public.is_papangu_admin());
drop policy if exists "Administrador atualiza foto de mensalista" on storage.objects;
create policy "Administrador atualiza foto de mensalista"
on storage.objects for update to authenticated
using (bucket_id = 'player-photos' and public.is_papangu_admin())
with check (bucket_id = 'player-photos' and public.is_papangu_admin());
-- A atualizacao do campo foto_path ja e permitida ao administrador pela policy de public.players.
