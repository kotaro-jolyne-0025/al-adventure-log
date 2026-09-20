ALTER TABLE "character"
    ADD COLUMN IF NOT EXISTS initial_gold DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS initial_downtime INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'character_initial_gold_nonnegative_check'
    ) THEN
        ALTER TABLE "character"
            ADD CONSTRAINT character_initial_gold_nonnegative_check CHECK (initial_gold >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'character_initial_downtime_nonnegative_check'
    ) THEN
        ALTER TABLE "character"
            ADD CONSTRAINT character_initial_downtime_nonnegative_check CHECK (initial_downtime >= 0);
    END IF;
END $$;
