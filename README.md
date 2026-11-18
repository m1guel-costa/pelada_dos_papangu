# Pelada dos Papangu — Supabase
Esta branch implementa cadastro individual, perfil, ranking e sorteio com banco compartilhado.

## Configuração obrigatória
1. Crie um projeto gratuito em https://supabase.com/dashboard
2. Em **SQL Editor**, execute o conteúdo de `supabase-schema.sql` num projeto NOVO (não execute repetidamente).
3. Em **Project Settings > API** (ou Connect), copie a **Project URL** e a chave **publishable/anon** para `supabase-config.js`.
   Nunca publique chave **secret/service_role**.
4. Em **Authentication > Providers > Email**, mantenha confirmação por e-mail habilitada e configure URL do site em **Authentication > URL Configuration**.
5. Crie sua própria conta pelo site. Em **Authentication > Users**, copie seu UUID.
6. No SQL Editor, execute:
   `UPDATE public.players SET role = 'admin' WHERE id = 'SEU-UUID';`
   Confirme que apenas sua conta recebeu o papel admin.
7. Teste cadastro em outro navegador, login, atualização de perfil, ranking compartilhado e bloqueio de estrelas.
8. Só então integre esta branch à `main` para publicar na Cloudflare.

**Atenção:** contas antigas em localStorage não são migradas. Não compartilhe o site com o grupo antes de concluir e testar a configuração. Não use a senha administrativa antiga.
