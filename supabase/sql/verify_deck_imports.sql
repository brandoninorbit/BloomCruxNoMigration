select to_regclass('public.deck_imports') as table_ref;
select schemaname, tablename, policyname from pg_policies where tablename='deck_imports' order by policyname;
