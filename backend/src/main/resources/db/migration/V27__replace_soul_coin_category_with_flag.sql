-- Keep V25/V26 intact; convert the former category into an independent marker.
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS is_soul_coin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE adventure_gained_item ADD COLUMN IF NOT EXISTS is_soul_coin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE inventory_item SET is_soul_coin = TRUE, item_category = NULL
WHERE item_category = 'SOUL_COIN';
UPDATE adventure_gained_item SET is_soul_coin = TRUE, item_category = NULL
WHERE item_category = 'SOUL_COIN';

-- Normalize only the former standard name, never custom names or notes.
UPDATE inventory_item SET item_name = '靈魂幣'
WHERE is_soul_coin AND item_name = '靈魂硬幣';
UPDATE adventure_gained_item SET item_name = '靈魂幣'
WHERE is_soul_coin AND item_name = '靈魂硬幣';

ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS inventory_item_category_check;
ALTER TABLE adventure_gained_item DROP CONSTRAINT IF EXISTS adventure_gained_item_category_check;
ALTER TABLE inventory_item ADD CONSTRAINT inventory_item_category_check CHECK (
    item_category IS NULL OR item_category IN ('ARMOR','POTION','RING','ROD','SCROLL','STAFF','WAND','WEAPON','WONDROUS_ITEM'));
ALTER TABLE adventure_gained_item ADD CONSTRAINT adventure_gained_item_category_check CHECK (
    item_category IS NULL OR item_category IN ('ARMOR','POTION','RING','ROD','SCROLL','STAFF','WAND','WEAPON','WONDROUS_ITEM'));

ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS inventory_soul_coin_type_check;
ALTER TABLE adventure_gained_item DROP CONSTRAINT IF EXISTS gained_soul_coin_type_check;
ALTER TABLE inventory_item ADD CONSTRAINT inventory_soul_coin_type_check CHECK (NOT is_soul_coin OR item_type = 'CONSUMABLE');
ALTER TABLE adventure_gained_item ADD CONSTRAINT gained_soul_coin_type_check CHECK (NOT is_soul_coin OR item_type = 'CONSUMABLE');
