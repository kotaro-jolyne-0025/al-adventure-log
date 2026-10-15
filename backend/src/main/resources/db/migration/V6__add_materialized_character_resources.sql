-- ==============================================================================
-- V6: 角色衍生資源欄位 (Materialized Character Resources)
-- ==============================================================================

ALTER TABLE "character" ADD COLUMN IF NOT EXISTS current_gold NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS current_downtime INTEGER DEFAULT 0;
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS current_magic_items INTEGER DEFAULT 0;
