-- ==========================================
-- V1: 初始資料庫結構 (Initial Schema)
-- ==========================================

-- 1. character 資料表
CREATE TABLE IF NOT EXISTS "character" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_name VARCHAR(100) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    race VARCHAR(100) NOT NULL,
    faction VARCHAR(100),
    current_classes_string VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. adventure_entry 資料表
CREATE TABLE IF NOT EXISTS adventure_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES "character"(id) ON DELETE CASCADE,
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

-- 3. downtime_activity 資料表
CREATE TABLE IF NOT EXISTS downtime_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. inventory_item 資料表
DO $$ BEGIN
    CREATE TYPE item_type AS ENUM ('PERMANENT', 'CONSUMABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS inventory_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES "character"(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_type item_type NOT NULL,
    rarity item_rarity,
    quantity INTEGER DEFAULT 1,
    source VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. updated_at 觸發器函式
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_character_updated_at
        BEFORE UPDATE ON "character"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_adventure_entry_updated_at
        BEFORE UPDATE ON adventure_entry
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_downtime_activity_updated_at
        BEFORE UPDATE ON downtime_activity
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_inventory_item_updated_at
        BEFORE UPDATE ON inventory_item
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;
