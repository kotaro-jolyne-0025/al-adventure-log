-- Flyway executes this migration in one transaction. Do not rewrite old history totals.
ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS inventory_item_category_check;
ALTER TABLE adventure_gained_item DROP CONSTRAINT IF EXISTS adventure_gained_item_category_check;
ALTER TABLE inventory_item ADD CONSTRAINT inventory_item_category_check CHECK (
    item_category IS NULL OR item_category IN ('ARMOR','POTION','RING','ROD','SCROLL','STAFF','WAND','WEAPON','WONDROUS_ITEM','SOUL_COIN'));
ALTER TABLE adventure_gained_item ADD CONSTRAINT adventure_gained_item_category_check CHECK (
    item_category IS NULL OR item_category IN ('ARMOR','POTION','RING','ROD','SCROLL','STAFF','WAND','WEAPON','WONDROUS_ITEM','SOUL_COIN'));
ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS inventory_soul_coin_type_check;
ALTER TABLE adventure_gained_item DROP CONSTRAINT IF EXISTS gained_soul_coin_type_check;
ALTER TABLE inventory_item ADD CONSTRAINT inventory_soul_coin_type_check CHECK (item_category IS DISTINCT FROM 'SOUL_COIN' OR item_type = 'CONSUMABLE');
ALTER TABLE adventure_gained_item ADD CONSTRAINT gained_soul_coin_type_check CHECK (item_category IS DISTINCT FROM 'SOUL_COIN' OR item_type = 'CONSUMABLE');

-- A character-side marker survives consumption/deletion of the transferred item.
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS soul_coins_transferred BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO inventory_item (id, character_id, item_name, item_type, item_category, quantity, source, notes, created_at, updated_at)
SELECT gen_random_uuid(), id, '靈魂硬幣', 'CONSUMABLE', 'SOUL_COIN', soul_coins,
       '角色靈魂幣轉移', '原角色獨立靈魂幣數量', NOW(), NOW()
FROM "character" WHERE NOT soul_coins_transferred AND soul_coins > 0;
UPDATE "character" SET soul_coins = 0, soul_coins_transferred = TRUE WHERE NOT soul_coins_transferred;

ALTER TABLE adventure_entry ADD COLUMN IF NOT EXISTS magic_items_lost INTEGER;
ALTER TABLE adventure_entry ADD COLUMN IF NOT EXISTS magic_items_downtime_lost INTEGER;
-- Infer legacy losses once. Consumption does not remove gained snapshots.
UPDATE adventure_entry ae SET
    magic_items_lost = COALESCE(magic_items_lost, GREATEST(0,
        (SELECT COUNT(*)::int FROM adventure_gained_item gi WHERE gi.adventure_entry_id = ae.id
         AND gi.item_type = 'PERMANENT' AND COALESCE(gi.acquisition_source, 'ADVENTURE') = 'ADVENTURE') - COALESCE(magic_items_change, 0))),
    magic_items_downtime_lost = COALESCE(magic_items_downtime_lost, GREATEST(0,
        (SELECT COUNT(*)::int FROM adventure_gained_item gi WHERE gi.adventure_entry_id = ae.id
         AND gi.item_type = 'PERMANENT' AND gi.acquisition_source = 'DOWNTIME') - COALESCE(magic_items_downtime_change, 0)))
WHERE magic_items_lost IS NULL OR magic_items_downtime_lost IS NULL;
ALTER TABLE adventure_entry ALTER COLUMN magic_items_lost SET DEFAULT 0;
ALTER TABLE adventure_entry ALTER COLUMN magic_items_lost SET NOT NULL;
ALTER TABLE adventure_entry ALTER COLUMN magic_items_downtime_lost SET DEFAULT 0;
ALTER TABLE adventure_entry ALTER COLUMN magic_items_downtime_lost SET NOT NULL;
ALTER TABLE adventure_entry DROP CONSTRAINT IF EXISTS adventure_magic_items_lost_check;
ALTER TABLE adventure_entry ADD CONSTRAINT adventure_magic_items_lost_check CHECK (magic_items_lost >= 0 AND magic_items_downtime_lost >= 0);
