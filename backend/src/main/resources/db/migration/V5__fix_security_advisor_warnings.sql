-- ==========================================
-- V5: 修復 Supabase Security Advisor 安全警告 (Security Hardening)
-- ==========================================

-- 1. 修復 update_updated_at_column 函式，指定明確 search_path 防止 search_path 劫持
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' SET search_path = public;

-- 2. 收回 rls_auto_enable 函式之公開 (PUBLIC / anon / authenticated) 執行權限
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    END IF;
END $$;
