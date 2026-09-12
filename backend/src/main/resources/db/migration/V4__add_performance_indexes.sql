-- ==========================================
-- V4: 新增外鍵與查詢效能索引 (Performance Indexes)
-- ==========================================

-- 1. 冒險記錄表索引 (優化按角色查詢與日期排序)
CREATE INDEX IF NOT EXISTS idx_adventure_entry_char_playdate 
    ON adventure_entry (character_id, play_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adventure_entry_char_playdate_asc 
    ON adventure_entry (character_id, play_date ASC, created_at ASC);

-- 2. 休整期活動表索引 (優化按冒險記錄查詢)
CREATE INDEX IF NOT EXISTS idx_downtime_activity_entry_created 
    ON downtime_activity (adventure_entry_id, created_at ASC);

-- 3. 倉庫道具表索引 (優化按角色與物品類型過濾查詢)
CREATE INDEX IF NOT EXISTS idx_inventory_item_char_type_created 
    ON inventory_item (character_id, item_type, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_inventory_item_char_created 
    ON inventory_item (character_id, created_at ASC);

-- 4. 角色表索引 (優化使用者角色清單查詢)
CREATE INDEX IF NOT EXISTS idx_character_user_created 
    ON "character" (user_id, created_at DESC);
