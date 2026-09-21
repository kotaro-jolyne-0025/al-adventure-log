-- Fail clearly if an unrecognized legacy class remains; do not silently retain localized DB values.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_initial_classes_english_check') THEN
        ALTER TABLE "character"
            ADD CONSTRAINT character_initial_classes_english_check
            CHECK (initial_classes_string IS NULL OR initial_classes_string = '' OR
                   initial_classes_string ~ '^(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+(/(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+)*$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_current_classes_english_check') THEN
        ALTER TABLE "character"
            ADD CONSTRAINT character_current_classes_english_check
            CHECK (current_classes_string IS NULL OR current_classes_string = '' OR
                   current_classes_string ~ '^(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+(/(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+)*$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adventure_starting_classes_english_check') THEN
        ALTER TABLE adventure_entry
            ADD CONSTRAINT adventure_starting_classes_english_check
            CHECK (starting_classes_string IS NULL OR starting_classes_string = '' OR
                   starting_classes_string ~ '^(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+(/(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+)*$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adventure_ending_classes_english_check') THEN
        ALTER TABLE adventure_entry
            ADD CONSTRAINT adventure_ending_classes_english_check
            CHECK (ending_classes_string IS NULL OR ending_classes_string = '' OR
                   ending_classes_string ~ '^(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+(/(Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard|Artificer)[0-9]+)*$');
    END IF;
END $$;
