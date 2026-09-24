-- ==========================================
-- V3: 清除既有測試資料 (Historical DB Reset; No Seed User)
-- ==========================================

-- 1. 清空所有舊資料（保留表結構與觸發器）
TRUNCATE TABLE inventory_item CASCADE;
TRUNCATE TABLE downtime_activity CASCADE;
TRUNCATE TABLE adventure_entry CASCADE;
TRUNCATE TABLE "character" CASCADE;
TRUNCATE TABLE user_oauth_accounts CASCADE;
TRUNCATE TABLE users CASCADE;

-- No default users. Accounts are created through registration or OAuth login.
-- Existing databases: see docs/public-repository-cleanup.md before deploying.
