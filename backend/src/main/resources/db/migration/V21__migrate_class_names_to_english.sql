-- Store class identifiers in English while keeping labels a frontend concern.
CREATE FUNCTION normalize_dnd_class_levels(class_string text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT string_agg(
        CASE lower(trim(regexp_replace(
            regexp_replace(segment, '[0-9]+$', ''),
            '\s*\([^)]*\)$', ''
        )))
            WHEN 'barbarian' THEN 'Barbarian'
            WHEN '野蠻人' THEN 'Barbarian'
            WHEN 'bard' THEN 'Bard'
            WHEN '吟遊詩人' THEN 'Bard'
            WHEN 'cleric' THEN 'Cleric'
            WHEN '牧師' THEN 'Cleric'
            WHEN 'druid' THEN 'Druid'
            WHEN '德魯伊' THEN 'Druid'
            WHEN 'fighter' THEN 'Fighter'
            WHEN '戰士' THEN 'Fighter'
            WHEN 'monk' THEN 'Monk'
            WHEN '武僧' THEN 'Monk'
            WHEN 'paladin' THEN 'Paladin'
            WHEN '聖騎士' THEN 'Paladin'
            WHEN 'ranger' THEN 'Ranger'
            WHEN '遊俠' THEN 'Ranger'
            WHEN 'rogue' THEN 'Rogue'
            WHEN '遊蕩者' THEN 'Rogue'
            WHEN '盜賊' THEN 'Rogue'
            WHEN 'sorcerer' THEN 'Sorcerer'
            WHEN '術士' THEN 'Sorcerer'
            WHEN 'warlock' THEN 'Warlock'
            WHEN '邪術士' THEN 'Warlock'
            WHEN '契術師' THEN 'Warlock'
            WHEN 'wizard' THEN 'Wizard'
            WHEN '法師' THEN 'Wizard'
            WHEN 'artificer' THEN 'Artificer'
            WHEN '奇械師' THEN 'Artificer'
            WHEN '奇術師' THEN 'Artificer'
            ELSE trim(regexp_replace(segment, '[0-9]+$', ''))
        END || COALESCE(substring(segment from '([0-9]+)$'), '1'),
        '/' ORDER BY ordinal
    )
    FROM unnest(string_to_array(class_string, '/')) WITH ORDINALITY AS parts(segment, ordinal)
    WHERE trim(segment) <> '';
$$;

UPDATE "character"
SET initial_classes_string = normalize_dnd_class_levels(initial_classes_string),
    current_classes_string = normalize_dnd_class_levels(current_classes_string)
WHERE initial_classes_string IS NOT NULL OR current_classes_string IS NOT NULL;

UPDATE adventure_entry
SET starting_classes_string = normalize_dnd_class_levels(starting_classes_string),
    ending_classes_string = normalize_dnd_class_levels(ending_classes_string)
WHERE starting_classes_string IS NOT NULL OR ending_classes_string IS NOT NULL;

DROP FUNCTION normalize_dnd_class_levels(text);
