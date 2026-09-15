-- 新增字串欄位
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS current_classes_string VARCHAR(255);
ALTER TABLE "adventure_entry" ADD COLUMN IF NOT EXISTS starting_classes_string VARCHAR(255);
ALTER TABLE "adventure_entry" ADD COLUMN IF NOT EXISTS ending_classes_string VARCHAR(255);

-- 為了確保您的舊資料不遺失，先手動將舊的 "角色" 當前等級彙整成字串：
UPDATE "character" c
SET current_classes_string = (
    SELECT string_agg(cl.class_name || ' Lv.' || cl.level, ' / ' ORDER BY cl.sort_order)
    FROM character_class_level cl
    WHERE cl.character_id = c.id
);

-- 將舊的 "冒險紀錄表" starting snapshot 彙整成字串：
UPDATE adventure_entry ae
SET starting_classes_string = (
    SELECT string_agg(s.class_name || ' Lv.' || s.level, ' / ' ORDER BY s.sort_order)
    FROM adventure_entry_class_snapshot s
    WHERE s.adventure_entry_id = ae.id AND s.snapshot_type = 'starting'
);

-- 將舊的 "冒險紀錄表" ending snapshot 彙整成字串：
UPDATE adventure_entry ae
SET ending_classes_string = (
    SELECT string_agg(s.class_name || ' Lv.' || s.level, ' / ' ORDER BY s.sort_order)
    FROM adventure_entry_class_snapshot s
    WHERE s.adventure_entry_id = ae.id AND s.snapshot_type = 'ending'
);

-- 刪除不再使用的複雜關聯表
DROP TABLE IF EXISTS "adventure_entry_class_snapshot" CASCADE;
DROP TABLE IF EXISTS "character_class_level" CASCADE;
