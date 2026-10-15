-- ==============================================================================
-- V18: 補齊唯一性保護，並移除確認重複的索引
-- ==============================================================================

-- OAuth provider + provider user id 必須唯一。
-- V2 原本已建立同名 UNIQUE constraint；若正式環境已有，底層同名索引會讓此處安全略過。
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_account
    ON user_oauth_accounts (provider, provider_user_id);

-- PostgreSQL B-tree 可以反向掃描，同一組欄位不需要同時維護 ASC 與 DESC 索引。
DROP INDEX IF EXISTS idx_adventure_entry_char_playdate_asc;

-- idx_character_user_created 的第一欄已是 user_id，可支援只按 user_id 查詢。
DROP INDEX IF EXISTS idx_character_user_id;

-- token 欄位的 UNIQUE constraint 已自動建立唯一索引。
DROP INDEX IF EXISTS idx_password_reset_token;
