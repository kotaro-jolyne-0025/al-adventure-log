-- ==========================================
-- V3: 清除既有測試資料並建立預設玩家帳號 (Clean DB & Seed Default User)
-- ==========================================

-- 1. 清空所有舊資料（保留表結構與觸發器）
TRUNCATE TABLE inventory_item CASCADE;
TRUNCATE TABLE downtime_activity CASCADE;
TRUNCATE TABLE adventure_entry CASCADE;
TRUNCATE TABLE "character" CASCADE;
TRUNCATE TABLE user_oauth_accounts CASCADE;
TRUNCATE TABLE users CASCADE;

-- 2. 建立預設玩家帳號
-- 帳號：redacted-account@example.invalid
-- 密碼：REDACTED_PASSWORD
-- 顯示名稱：可嵐
INSERT INTO users (id, email, password_hash, display_name, avatar_url, is_active, created_at, updated_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'redacted-account@example.invalid',
    'REDACTED_PASSWORD_HASH',
    '可嵐',
    NULL,
    TRUE,
    NOW(),
    NOW()
);
