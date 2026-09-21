-- ==============================================================================
-- V16: 將 adventure_story_award 納入 Flyway 管理
--
-- 正式 Supabase 已經存在這張表，但舊版 migration 沒有建立它。
-- 使用 IF NOT EXISTS，讓既有環境安全略過，新環境則能完整重建 schema。
-- ==============================================================================

CREATE TABLE IF NOT EXISTS adventure_story_award (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_entry_id UUID NOT NULL
        REFERENCES adventure_entry(id) ON DELETE CASCADE,
    award_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_award_entry_created
    ON adventure_story_award (adventure_entry_id, created_at ASC);

-- 重建 updated_at trigger，確保手動建立過的正式環境和全新環境行為一致。
DROP TRIGGER IF EXISTS update_adventure_story_award_updated_at
    ON adventure_story_award;

CREATE TRIGGER update_adventure_story_award_updated_at
    BEFORE UPDATE ON adventure_story_award
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
