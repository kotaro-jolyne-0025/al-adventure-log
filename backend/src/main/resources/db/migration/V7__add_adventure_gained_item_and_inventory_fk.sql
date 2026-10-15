-- ==============================================================================
-- V7: 建立冒險戰利品專屬快照表 (adventure_gained_item) 與倉庫連帶外鍵 (adventure_entry_id)
-- ==============================================================================

-- 1. 建立 adventure_gained_item 冒險獲得物品快照表
CREATE TABLE IF NOT EXISTS adventure_gained_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adventure_gained_item_entry 
    ON adventure_gained_item(adventure_entry_id, created_at ASC);

-- 觸發器：自動更新 updated_at
DROP TRIGGER IF EXISTS update_adventure_gained_item_updated_at ON adventure_gained_item;
CREATE TRIGGER update_adventure_gained_item_updated_at
    BEFORE UPDATE ON adventure_gained_item
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. inventory_item 增加 adventure_entry_id 外鍵關聯
ALTER TABLE inventory_item 
    ADD COLUMN IF NOT EXISTS adventure_entry_id UUID 
        REFERENCES adventure_entry(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_item_adventure_id 
    ON inventory_item(adventure_entry_id);

-- 3. 歷史資料平滑回填 (Backfill)
UPDATE inventory_item i
SET adventure_entry_id = e.id
FROM adventure_entry e
WHERE i.character_id = e.character_id 
  AND (i.source = e.adventure_name OR i.source = e.adventure_code)
  AND i.adventure_entry_id IS NULL;

INSERT INTO adventure_gained_item (id, adventure_entry_id, item_name, item_type, rarity, quantity, notes, created_at)
SELECT gen_random_uuid(), i.adventure_entry_id, i.item_name, i.item_type::text, i.rarity::text, i.quantity, i.notes, i.created_at
FROM inventory_item i
WHERE i.adventure_entry_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM adventure_gained_item agi 
      WHERE agi.adventure_entry_id = i.adventure_entry_id 
        AND agi.item_name = i.item_name
  );
