-- Keep existing columns and triggers; replace transaction-start NOW() so every update advances.
-- CREATE OR REPLACE is safe to execute again and retains the existing search_path restriction.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = GREATEST(clock_timestamp()::timestamp,
                             OLD.updated_at + INTERVAL '1 microsecond');
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' SET search_path = public;
