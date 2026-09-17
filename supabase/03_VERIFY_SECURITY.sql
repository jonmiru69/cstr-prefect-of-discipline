-- Read-only installation verification. Run in SQL Editor.
-- All rows below should have RLS=true and all browser table grants=false.
select tablename,
       rowsecurity as rls,
       has_table_privilege('anon',format('app_private.%I',tablename),'SELECT') as anon_can_read,
       has_table_privilege('authenticated',format('app_private.%I',tablename),'SELECT') as staff_can_read_directly,
       has_table_privilege('authenticated',format('app_private.%I',tablename),'INSERT') as staff_can_insert_directly,
       has_table_privilege('authenticated',format('app_private.%I',tablename),'UPDATE') as staff_can_update_directly,
       has_table_privilege('authenticated',format('app_private.%I',tablename),'DELETE') as staff_can_delete_directly
from pg_tables where schemaname='app_private' order by tablename;
-- The school app accesses records only through checked public functions.
select p.proname, p.prosecdef as security_definer, p.proconfig as fixed_search_path
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_case','save_case','export_records','portal_bootstrap');
