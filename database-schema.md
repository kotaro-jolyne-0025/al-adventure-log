# D&D 冒險日誌系統 — 資料庫 Schema
# 請到 Supabase Dashboard → SQL Editor 依序執行以下 SQL

---

## Step 1：建立 character 資料表

```sql
CREATE TABLE IF NOT EXISTS character (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_name VARCHAR(100) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    race VARCHAR(100) NOT NULL,
    subclass VARCHAR(100),
    faction VARCHAR(100),
    avatar_url TEXT,
    current_classes_string VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Step 2：建立 adventure_entry 資料表

```sql
CREATE TABLE IF NOT EXISTS adventure_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
    adventure_code VARCHAR(100),
    adventure_name VARCHAR(255),
    play_date DATE,
    dm_name VARCHAR(100),
    starting_level INTEGER,
    ending_level INTEGER,
    starting_classes_string VARCHAR(255),
    ending_classes_string VARCHAR(255),
    starting_gold DECIMAL(10,2),
    gold_change DECIMAL(10,2),
    gold_total DECIMAL(10,2),
    starting_downtime INTEGER,
    downtime_change INTEGER,
    downtime_total INTEGER,
    starting_magic_items INTEGER,
    magic_items_change INTEGER,
    magic_items_total INTEGER,
    gold_downtime_change DECIMAL(10,2),
    downtime_downtime_change INTEGER,
    magic_items_downtime_change INTEGER,
    level_up_class_name VARCHAR(100),
    catchup_class_name VARCHAR(100),
    catchup_count INTEGER DEFAULT 0,
    adventure_notes TEXT,
    soul_coin_charges_used VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

> **注意（已部署資料庫的 Migration）：**
> 若 `adventure_entry` 資料表已存在，請在 Supabase SQL Editor 依序執行以下 ALTER：
>
> **Migration 1（T08）：**
> ```sql
> ALTER TABLE adventure_entry
>     ADD COLUMN IF NOT EXISTS starting_level INTEGER,
>     ADD COLUMN IF NOT EXISTS ending_level INTEGER;
> ```
>
> **Migration 2（T10）：**
> ```sql
> ALTER TABLE adventure_entry
>     ADD COLUMN IF NOT EXISTS gold_downtime_change DECIMAL(10,2),
>     ADD COLUMN IF NOT EXISTS downtime_downtime_change INTEGER,
>     ADD COLUMN IF NOT EXISTS magic_items_downtime_change INTEGER;
> ```
>
> **Migration 3：String-Based Class Levels**
> ```sql
> -- 新增字串欄位
> ALTER TABLE "character" ADD COLUMN IF NOT EXISTS current_classes_string VARCHAR(255);
> ALTER TABLE "adventure_entry" ADD COLUMN IF NOT EXISTS starting_classes_string VARCHAR(255);
> ALTER TABLE "adventure_entry" ADD COLUMN IF NOT EXISTS ending_classes_string VARCHAR(255);
> 
> -- 刪除不再使用的複雜關聯表
> DROP TABLE IF EXISTS "adventure_entry_class_snapshot" CASCADE;
> DROP TABLE IF EXISTS "character_class_level" CASCADE;
> ```
>
> **Migration 4（T14）：**
> ```sql
> ALTER TABLE adventure_entry
>     ADD COLUMN IF NOT EXISTS catchup_class_name VARCHAR(100),
>     ADD COLUMN IF NOT EXISTS catchup_count INTEGER DEFAULT 0;
> ```

---

>     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
>     snapshot_type VARCHAR(10) NOT NULL,
>     class_name VARCHAR(100) NOT NULL,
>     level INTEGER NOT NULL,
>     sort_order INTEGER DEFAULT 0
> );
> ```

---

## Step 4：建立 downtime_activity 資料表（休整期活動）

```sql
CREATE TABLE IF NOT EXISTS downtime_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Step 5：建立 inventory_item 資料表（倉庫）

```sql
CREATE TYPE item_type AS ENUM ('PERMANENT', 'CONSUMABLE');
CREATE TYPE item_rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY');

CREATE TABLE IF NOT EXISTS inventory_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_type item_type NOT NULL,
    rarity item_rarity,
    quantity INTEGER DEFAULT 1,
    source VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Step 0：建立 users 與 user_oauth_accounts 資料表（會員與第三方認證）

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_provider_account UNIQUE (provider, provider_user_id)
);
```

---

## Step 6：建立自動更新 updated_at 的觸發器

```sql
-- 建立觸發器函式
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 套用到 users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 套用到 user_oauth_accounts
CREATE TRIGGER update_user_oauth_accounts_updated_at
    BEFORE UPDATE ON user_oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 套用到 character
CREATE TRIGGER update_character_updated_at
    BEFORE UPDATE ON character
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 套用到 adventure_entry
CREATE TRIGGER update_adventure_entry_updated_at
    BEFORE UPDATE ON adventure_entry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 套用到 downtime_activity
CREATE TRIGGER update_downtime_activity_updated_at
    BEFORE UPDATE ON downtime_activity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 套用到 inventory_item
CREATE TRIGGER update_inventory_item_updated_at
    BEFORE UPDATE ON inventory_item
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Migration 5（Auth & Multi-tenancy）：
```sql
-- 1. 建立 users 表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 建立 user_oauth_accounts 表
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_provider_account UNIQUE (provider, provider_user_id)
);

-- 3. character 表新增 user_id 欄位與索引
ALTER TABLE "character" 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_character_user_id ON "character"(user_id);
```

---

## Migration 6（效能與外鍵索引優化）：
```sql
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
```

---

## Migration 7（Supabase Security Advisor 安全警告修復）：
```sql
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
```

## Migration 7（冒險戰利品快照表與倉庫級聯外鍵）：
```sql
-- 1. 建立 adventure_gained_item 冒險戰利品快照表
CREATE TABLE IF NOT EXISTS adventure_gained_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adventure_gained_item_entry 
    ON adventure_gained_item(adventure_entry_id, created_at ASC);

-- 觸發器：自動維護 updated_at
CREATE TRIGGER update_adventure_gained_item_updated_at
    BEFORE UPDATE ON adventure_gained_item
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. inventory_item 增加 adventure_entry_id 外鍵關聯
ALTER TABLE inventory_item 
    ADD COLUMN IF NOT EXISTS adventure_entry_id UUID 
        REFERENCES adventure_entry(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_item_adventure_id 
    ON inventory_item(adventure_entry_id);

-- 3. 歷史資料平滑回填 (Backfill)
UPDATE inventory_item i
SET adventure_entry_id = e.id
FROM adventure_entry e
WHERE i.character_id = e.character_id 
  AND (i.source = e.adventure_name OR i.source = e.adventure_code)
  AND i.adventure_entry_id IS NULL;

INSERT INTO adventure_gained_item (id, adventure_entry_id, item_name, item_type, rarity, quantity, notes, created_at)
SELECT gen_random_uuid(), i.adventure_entry_id, i.item_name, i.item_type::text, i.rarity::text, i.quantity, i.notes, i.created_at
FROM inventory_item i
WHERE i.adventure_entry_id IS NOT NULL;
```

---

## Migration 8（倉庫背包與冒險快照項精準綁定）：
```sql
-- 1. inventory_item 增加 adventure_gained_item_id 外鍵關聯 (ON DELETE CASCADE)
ALTER TABLE inventory_item 
    ADD COLUMN IF NOT EXISTS adventure_gained_item_id UUID 
        REFERENCES adventure_gained_item(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_item_gained_id 
    ON inventory_item(adventure_gained_item_id);

-- 2. 歷史資料平滑回填
UPDATE inventory_item i
SET adventure_gained_item_id = agi.id
FROM adventure_gained_item agi
WHERE i.adventure_entry_id = agi.adventure_entry_id
  AND i.item_name = agi.item_name
  AND i.adventure_gained_item_id IS NULL;
---

## Migration 9（角色資料表新增子職欄位 subclass）：
```sql
ALTER TABLE "character" 
    ADD COLUMN IF NOT EXISTS subclass VARCHAR(100);
```

---

## Migration 10（角色資料表新增頭像欄位 avatar_url）：
```sql
ALTER TABLE "character" 
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

---

---

## Migration 12（密碼重設 Token 表 password_reset_tokens）：
```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expiry_time TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
```

---

## 資料表關聯圖

```
users
├── user_oauth_accounts  (1:N，CASCADE DELETE)
├── password_reset_tokens (1:N，CASCADE DELETE)
└── character            (1:N，CASCADE DELETE)
    ├── adventure_entry        (1:N，CASCADE DELETE)
    │   ├── downtime_activity  (1:N，CASCADE DELETE)
    │   ├── adventure_gained_item (1:N，CASCADE DELETE)
    │   │   └── inventory_item (1:1/1:N 精準綁定，CASCADE DELETE)
    │   └── inventory_item     (1:N，CASCADE DELETE，手動道具為 NULL)
    └── inventory_item         (1:N，CASCADE DELETE)
```

