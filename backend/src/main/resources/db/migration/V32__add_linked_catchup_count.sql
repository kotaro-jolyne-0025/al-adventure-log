ALTER TABLE adventure_entry
    ADD COLUMN IF NOT EXISTS linked_catchup_count INTEGER
    CONSTRAINT adventure_entry_linked_catchup_count_range CHECK (linked_catchup_count BETWEEN 0 AND 19);

UPDATE adventure_entry
SET linked_catchup_count = ending_level - starting_level - 1
WHERE linked_catchup_count IS NULL
  AND starting_level >= 0
  AND ending_level BETWEEN 2 AND 20
  AND ending_level - starting_level BETWEEN 2 AND 20
  AND downtime_downtime_change = -10 * (ending_level - starting_level - 1);
