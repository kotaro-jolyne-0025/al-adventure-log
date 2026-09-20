-- Read-only delta-ledger consistency report. This file intentionally contains
-- SELECT statements only and is safe to run against production for diagnosis.

-- 1. Character class snapshots whose slash-separated segments do not end in a level.
SELECT c.id AS character_id, values.classes_string, values.field_name
FROM "character" c
CROSS JOIN LATERAL (VALUES
    (c.initial_classes_string, 'initial_classes_string'),
    (c.current_classes_string, 'current_classes_string')
) AS values(classes_string, field_name)
WHERE values.classes_string IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(values.classes_string, '/') AS segment
      WHERE btrim(segment) = '' OR btrim(segment) !~ '^.+[0-9]+$'
  )
ORDER BY c.id, values.field_name;

-- 2. Items whose acquisition source cannot be confirmed.
SELECT 'adventure_gained_item' AS table_name, id, adventure_entry_id, item_name
FROM adventure_gained_item
WHERE acquisition_source IS NULL
UNION ALL
SELECT 'inventory_item' AS table_name, id, adventure_entry_id, item_name
FROM inventory_item
WHERE acquisition_source IS NULL
ORDER BY table_name, id;

-- 3. Materialized character magic-item totals that differ from warehouse quantities.
SELECT c.id AS character_id,
       c.current_magic_items AS stored_total,
       COALESCE(inventory.permanent_quantity, 0) AS warehouse_total
FROM "character" c
LEFT JOIN (
    SELECT character_id, SUM(quantity) AS permanent_quantity
    FROM inventory_item
    WHERE item_type = 'PERMANENT'
    GROUP BY character_id
) inventory ON inventory.character_id = c.id
WHERE c.current_magic_items IS DISTINCT FROM COALESCE(inventory.permanent_quantity, 0)
ORDER BY c.id;
