-- ==============================================================================
-- V8: 連結 inventory_item 與 adventure_gained_item 快照表 (精準外鍵綁定與級聯)
-- ==============================================================================

-- 1. inventory_item 增加 adventure_gained_item_id 外鍵關聯 (ON DELETE CASCADE)
ALTER TABLE inventory_item 
    ADD COLUMN IF NOT EXISTS adventure_gained_item_id UUID 
        REFERENCES adventure_gained_item(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_item_gained_id 
    ON inventory_item(adventure_gained_item_id);

-- 2. 歷史資料平滑回填：依據 adventure_entry_id 與 item_name 配對
UPDATE inventory_item i
SET adventure_gained_item_id = agi.id
FROM adventure_gained_item agi
WHERE i.adventure_entry_id = agi.adventure_entry_id
  AND i.item_name = agi.item_name
  AND i.adventure_gained_item_id IS NULL;
