-- Convert partial unique to plain unique on codigo.
-- Reason: Supabase JS .upsert(onConflict:"codigo") doesn't pass index
-- predicates, so partial indexes are not matched by ON CONFLICT. Plain
-- unique works for the upsert pattern.
-- Tradeoff: can't have two rows with same codigo regardless of deleted
-- state. Brand It doesn't use soft-delete-and-re-add today.

DROP INDEX IF EXISTS clientes_master_codigo_unique;
CREATE UNIQUE INDEX clientes_master_codigo_unique ON clientes_master(codigo);
