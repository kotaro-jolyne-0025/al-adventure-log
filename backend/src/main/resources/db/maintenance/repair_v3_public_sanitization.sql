-- MANUAL, PRE-DEPLOYMENT maintenance only; deliberately outside db/migration.
-- Back up first. Never execute V3 again against an existing database.
-- Accept only the reviewed pre-sanitization checksum or the sanitized checksum.
DO $$
DECLARE
    history_checksum INTEGER;
BEGIN
    SELECT checksum INTO history_checksum
    FROM public.flyway_schema_history
    WHERE version = '3'
      AND script = 'V3__reset_db_and_seed_user.sql'
      AND type = 'SQL'
      AND success = TRUE
    FOR UPDATE;

    IF NOT FOUND OR history_checksum IS NULL
       OR history_checksum NOT IN (-1789094287, 841749704) THEN
        RAISE EXCEPTION 'Unexpected V3 history; stop and review before deploying';
    END IF;

    UPDATE public.flyway_schema_history
    SET checksum = 841749704
    WHERE version = '3'
      AND script = 'V3__reset_db_and_seed_user.sql'
      AND type = 'SQL'
      AND success = TRUE
      AND checksum = -1789094287;
END $$;
