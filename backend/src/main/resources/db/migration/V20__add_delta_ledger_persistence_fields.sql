-- ==============================================================================
-- V20: 變化式帳本、角色開卡基準與物品來源欄位
-- ==============================================================================

ALTER TABLE "character"
    ADD COLUMN IF NOT EXISTS initial_classes_string VARCHAR(255);

ALTER TABLE adventure_entry
    ADD COLUMN IF NOT EXISTS recording_model_version INTEGER DEFAULT 1;

ALTER TABLE adventure_gained_item
    ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS needs_details BOOLEAN DEFAULT FALSE;

ALTER TABLE inventory_item
    ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS needs_details BOOLEAN DEFAULT FALSE;

-- 舊角色以最早且每段皆帶等級數字的冒險起始職業作為開卡基準；
-- 找不到可靠快照時才保留目前職業。這裡不猜測無法解析的字串。
UPDATE "character" c
SET initial_classes_string = COALESCE(
    (
        SELECT ae.starting_classes_string
        FROM adventure_entry ae
        WHERE ae.character_id = c.id
          AND BTRIM(ae.starting_classes_string) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM REGEXP_SPLIT_TO_TABLE(ae.starting_classes_string, '/') AS segment
              WHERE BTRIM(segment) = '' OR BTRIM(segment) !~ '[0-9]+$'
          )
        ORDER BY ae.play_date ASC NULLS LAST, ae.created_at ASC, ae.id ASC
        LIMIT 1
    ),
    c.current_classes_string
)
WHERE c.initial_classes_string IS NULL;

UPDATE adventure_entry
SET recording_model_version = 1
WHERE recording_model_version IS NULL;

-- adventure_gained_item 本身必定連到冒險；inventory_item 則只在既有外鍵
-- 已能證明來自冒險時回填。無關聯的手動／來源不明舊資料保持 NULL。
UPDATE adventure_gained_item
SET acquisition_source = 'ADVENTURE'
WHERE acquisition_source IS NULL;

UPDATE inventory_item
SET acquisition_source = 'ADVENTURE'
WHERE acquisition_source IS NULL
  AND (adventure_entry_id IS NOT NULL OR adventure_gained_item_id IS NOT NULL);

UPDATE adventure_gained_item
SET needs_details = FALSE
WHERE needs_details IS NULL;

UPDATE inventory_item
SET needs_details = FALSE
WHERE needs_details IS NULL;

ALTER TABLE adventure_entry
    ALTER COLUMN recording_model_version SET DEFAULT 1,
    ALTER COLUMN recording_model_version SET NOT NULL;

ALTER TABLE adventure_gained_item
    ALTER COLUMN needs_details SET DEFAULT FALSE,
    ALTER COLUMN needs_details SET NOT NULL;

ALTER TABLE inventory_item
    ALTER COLUMN needs_details SET DEFAULT FALSE,
    ALTER COLUMN needs_details SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'adventure_entry_recording_model_version_check'
          AND conrelid = 'adventure_entry'::regclass
    ) THEN
        ALTER TABLE adventure_entry
            ADD CONSTRAINT adventure_entry_recording_model_version_check
            CHECK (recording_model_version IN (1, 2));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'adventure_gained_item_acquisition_source_check'
          AND conrelid = 'adventure_gained_item'::regclass
    ) THEN
        ALTER TABLE adventure_gained_item
            ADD CONSTRAINT adventure_gained_item_acquisition_source_check
            CHECK (acquisition_source IS NULL OR acquisition_source IN ('ADVENTURE', 'DOWNTIME'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inventory_item_acquisition_source_check'
          AND conrelid = 'inventory_item'::regclass
    ) THEN
        ALTER TABLE inventory_item
            ADD CONSTRAINT inventory_item_acquisition_source_check
            CHECK (acquisition_source IS NULL OR acquisition_source IN ('ADVENTURE', 'DOWNTIME'));
    END IF;
END $$;
