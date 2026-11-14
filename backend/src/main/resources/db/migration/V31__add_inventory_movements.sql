CREATE TABLE IF NOT EXISTS inventory_movement (
    id UUID PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES "character"(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('PERMANENT','CONSUMABLE')),
    previous_item_type VARCHAR(32),
    operation VARCHAR(16) NOT NULL CHECK (operation IN ('BASELINE','ACQUIRE','ADJUST','CONSUME','REMOVE','REVERSE')),
    reason VARCHAR(32) NOT NULL,
    quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
    quantity_delta INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
    source_entry_id UUID,
    source_gained_item_id UUID,
    source_name TEXT,
    source_code TEXT,
    usage_entry_id UUID REFERENCES adventure_entry(id) ON DELETE SET NULL,
    usage_original_entry_id UUID,
    usage_name TEXT,
    usage_code TEXT,
    notes VARCHAR(2000),
    reversal_of UUID UNIQUE REFERENCES inventory_movement(id) ON DELETE CASCADE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT clock_timestamp(),
    CHECK (quantity_after::bigint = quantity_before::bigint + quantity_delta::bigint)
);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_character_time ON inventory_movement(character_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_item_time ON inventory_movement(item_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_usage ON inventory_movement(usage_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movement_baseline ON inventory_movement(item_id) WHERE operation = 'BASELINE';

-- Hold the lock through the baseline and guard installation in the same transaction.
LOCK TABLE public.inventory_item IN ACCESS EXCLUSIVE MODE;
CREATE OR REPLACE FUNCTION public.require_inventory_movement_writer()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF current_setting('advlog.inventory_movements', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Inventory writer does not support movement history' USING ERRCODE = '55000';
    END IF;
    RETURN NULL;
END;
$$;
DO $$
BEGIN
    IF current_setting('advlog.install_inventory_guard', true) = 'on' THEN
        CREATE OR REPLACE TRIGGER require_inventory_movement_writer
            BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.inventory_item
            FOR EACH STATEMENT EXECUTE FUNCTION public.require_inventory_movement_writer();
    END IF;
END;
$$;
INSERT INTO inventory_movement(id,character_id,item_id,item_name,item_type,operation,reason,
    quantity_before,quantity_delta,quantity_after,source_entry_id,source_gained_item_id,source_name,source_code)
SELECT gen_random_uuid(),i.character_id,i.id,i.item_name,i.item_type::text,'BASELINE','BASELINE',
    0,i.quantity,i.quantity,i.adventure_entry_id,i.adventure_gained_item_id,e.adventure_name,e.adventure_code
FROM inventory_item i LEFT JOIN adventure_entry e ON e.id=i.adventure_entry_id
WHERE NOT EXISTS (SELECT 1 FROM inventory_movement m WHERE m.item_id=i.id)
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS update_inventory_movement_updated_at ON inventory_movement;
CREATE TRIGGER update_inventory_movement_updated_at BEFORE UPDATE ON inventory_movement
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE inventory_movement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inventory_movement FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
        REVOKE ALL ON inventory_movement FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        REVOKE ALL ON inventory_movement FROM authenticated;
    END IF;
END $$;
