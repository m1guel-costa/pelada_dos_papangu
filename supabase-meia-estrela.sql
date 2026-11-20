-- Execute uma vez no SQL Editor do Supabase.
-- Permite avaliações de 1,0 a 5,0, em intervalos de 0,5.
BEGIN;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_estrelas_check;
ALTER TABLE public.players ALTER COLUMN estrelas TYPE numeric(2,1) USING estrelas::numeric(2,1);
ALTER TABLE public.players ADD CONSTRAINT players_estrelas_check
CHECK (estrelas >= 1 AND estrelas <= 5 AND estrelas * 2 = trunc(estrelas * 2));
COMMIT;
-- Conferir as notas atuais
SELECT nome, estrelas FROM public.players ORDER BY estrelas DESC;
