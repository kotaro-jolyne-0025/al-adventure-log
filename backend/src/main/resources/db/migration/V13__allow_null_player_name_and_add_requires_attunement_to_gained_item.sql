-- ==========================================
-- V13: 角色玩家名稱解耦與冒險獲得物品同調支援
-- ==========================================

-- 1. 角色資料表 player_name 欄位改為可為 NULL
ALTER TABLE "character" ALTER COLUMN player_name DROP NOT NULL;

-- 2. 冒險獲得物品快照表 adventure_gained_item 新增 requires_attunement 欄位
ALTER TABLE adventure_gained_item 
    ADD COLUMN IF NOT EXISTS requires_attunement BOOLEAN DEFAULT FALSE;
