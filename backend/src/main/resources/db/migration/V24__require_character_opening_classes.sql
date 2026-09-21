-- 每個角色都必須有明確的開卡職業／等級基準。
-- 先中止不完整資料，避免以猜測值覆蓋既有角色。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "character"
        WHERE initial_classes_string IS NULL
           OR BTRIM(initial_classes_string) = ''
    ) THEN
        RAISE EXCEPTION 'Cannot require initial_classes_string while blank opening baselines exist';
    END IF;
END $$;

ALTER TABLE "character"
    ALTER COLUMN initial_classes_string SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'character_initial_classes_string_not_blank_check'
          AND conrelid = 'character'::regclass
    ) THEN
        ALTER TABLE "character"
            ADD CONSTRAINT character_initial_classes_string_not_blank_check
            CHECK (BTRIM(initial_classes_string) <> '');
    END IF;
END $$;
