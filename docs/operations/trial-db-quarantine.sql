\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

-- The cluster identifier and the new database name/OID come from the restore record.
SELECT set_config('student_care.restore_target', :'restore_db', true) AS target,
       set_config('student_care.restore_oid', :'restore_oid', true) AS oid,
       set_config('student_care.restore_cluster', :'restore_cluster', true) AS cluster
\gset restore_guard_

DO $guard$
BEGIN
  IF current_database() !~ '^sc_restore_[a-z0-9_]{1,40}$'
     OR current_database()::text IS DISTINCT FROM current_setting('student_care.restore_target')
     OR (SELECT system_identifier::text FROM pg_control_system())
        IS DISTINCT FROM current_setting('student_care.restore_cluster')
     OR (SELECT oid::text FROM pg_database WHERE datname = current_database())
        IS DISTINCT FROM current_setting('student_care.restore_oid') THEN
    RAISE EXCEPTION 'RESTORE_TARGET_MISMATCH';
  END IF;
END
$guard$;

LOCK TABLE public.invite_auth_sessions, public.pickup_credentials IN SHARE ROW EXCLUSIVE MODE;
DELETE FROM public.invite_auth_sessions;
UPDATE public.pickup_credentials
   SET invalidated_at = CURRENT_TIMESTAMP
 WHERE consumed_at IS NULL AND invalidated_at IS NULL;
COMMIT;
