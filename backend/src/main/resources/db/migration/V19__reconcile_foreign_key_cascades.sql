-- ==============================================================================
-- V19: 對齊正式 Supabase 的外鍵刪除規則與 OAuth 查詢索引
--
-- 舊環境可能在 Flyway 接管前就已建表，因此 CREATE TABLE IF NOT EXISTS 不會替既有
-- constraint 補上 ON DELETE CASCADE。服務層的刪除流程依賴這些 cascade，這裡明確
-- 重建外鍵，讓既有環境與全新環境行為一致。
-- ==============================================================================

ALTER TABLE "character"
    DROP CONSTRAINT IF EXISTS character_user_id_fkey,
    ADD CONSTRAINT character_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE adventure_entry
    DROP CONSTRAINT IF EXISTS adventure_entry_character_id_fkey,
    ADD CONSTRAINT adventure_entry_character_id_fkey
        FOREIGN KEY (character_id) REFERENCES "character"(id) ON DELETE CASCADE;

ALTER TABLE downtime_activity
    DROP CONSTRAINT IF EXISTS downtime_activity_adventure_entry_id_fkey,
    ADD CONSTRAINT downtime_activity_adventure_entry_id_fkey
        FOREIGN KEY (adventure_entry_id) REFERENCES adventure_entry(id) ON DELETE CASCADE;

ALTER TABLE adventure_gained_item
    DROP CONSTRAINT IF EXISTS adventure_gained_item_adventure_entry_id_fkey,
    ADD CONSTRAINT adventure_gained_item_adventure_entry_id_fkey
        FOREIGN KEY (adventure_entry_id) REFERENCES adventure_entry(id) ON DELETE CASCADE;

ALTER TABLE adventure_story_award
    DROP CONSTRAINT IF EXISTS adventure_story_award_adventure_entry_id_fkey,
    ADD CONSTRAINT adventure_story_award_adventure_entry_id_fkey
        FOREIGN KEY (adventure_entry_id) REFERENCES adventure_entry(id) ON DELETE CASCADE;

ALTER TABLE inventory_item
    DROP CONSTRAINT IF EXISTS inventory_item_character_id_fkey,
    ADD CONSTRAINT inventory_item_character_id_fkey
        FOREIGN KEY (character_id) REFERENCES "character"(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS inventory_item_adventure_entry_id_fkey,
    ADD CONSTRAINT inventory_item_adventure_entry_id_fkey
        FOREIGN KEY (adventure_entry_id) REFERENCES adventure_entry(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS inventory_item_adventure_gained_item_id_fkey,
    ADD CONSTRAINT inventory_item_adventure_gained_item_id_fkey
        FOREIGN KEY (adventure_gained_item_id) REFERENCES adventure_gained_item(id) ON DELETE CASCADE;

ALTER TABLE user_oauth_accounts
    DROP CONSTRAINT IF EXISTS user_oauth_accounts_user_id_fkey,
    ADD CONSTRAINT user_oauth_accounts_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE password_reset_tokens
    DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey,
    ADD CONSTRAINT password_reset_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user_id
    ON user_oauth_accounts (user_id);
