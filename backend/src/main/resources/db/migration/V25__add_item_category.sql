-- Existing items remain uncategorized. Keep both tables on the same category set.
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS item_category VARCHAR(32);
ALTER TABLE adventure_gained_item ADD COLUMN IF NOT EXISTS item_category VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_item_category_check' AND conrelid = 'inventory_item'::regclass) THEN
        ALTER TABLE inventory_item ADD CONSTRAINT inventory_item_category_check
            CHECK (item_category IS NULL OR item_category IN ('ARMOR', 'POTION', 'RING', 'ROD', 'SCROLL', 'STAFF', 'WAND', 'WEAPON', 'WONDROUS_ITEM'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adventure_gained_item_category_check' AND conrelid = 'adventure_gained_item'::regclass) THEN
        ALTER TABLE adventure_gained_item ADD CONSTRAINT adventure_gained_item_category_check
            CHECK (item_category IS NULL OR item_category IN ('ARMOR', 'POTION', 'RING', 'ROD', 'SCROLL', 'STAFF', 'WAND', 'WEAPON', 'WONDROUS_ITEM'));
    END IF;
END $$;
