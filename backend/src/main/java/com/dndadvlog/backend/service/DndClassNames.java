package com.dndadvlog.backend.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

final class DndClassNames {
    private static final Pattern LEVEL_SUFFIX = Pattern.compile("(\\d++)$");
    private static final Map<String, String> CANONICAL = Map.ofEntries(
            Map.entry("barbarian", "Barbarian"), Map.entry("野蠻人", "Barbarian"),
            Map.entry("bard", "Bard"), Map.entry("吟遊詩人", "Bard"),
            Map.entry("cleric", "Cleric"), Map.entry("牧師", "Cleric"),
            Map.entry("druid", "Druid"), Map.entry("德魯伊", "Druid"),
            Map.entry("fighter", "Fighter"), Map.entry("戰士", "Fighter"),
            Map.entry("monk", "Monk"), Map.entry("武僧", "Monk"),
            Map.entry("paladin", "Paladin"), Map.entry("聖騎士", "Paladin"),
            Map.entry("ranger", "Ranger"), Map.entry("遊俠", "Ranger"),
            Map.entry("rogue", "Rogue"), Map.entry("遊蕩者", "Rogue"), Map.entry("盜賊", "Rogue"),
            Map.entry("sorcerer", "Sorcerer"), Map.entry("術士", "Sorcerer"),
            Map.entry("warlock", "Warlock"), Map.entry("邪術士", "Warlock"), Map.entry("契術師", "Warlock"),
            Map.entry("wizard", "Wizard"), Map.entry("法師", "Wizard"),
            Map.entry("artificer", "Artificer"), Map.entry("奇械師", "Artificer"), Map.entry("奇術師", "Artificer")
    );

    private DndClassNames() {}

    static String canonicalize(String name) {
        String value = name == null ? "" : name.trim();
        String lower = value.toLowerCase(Locale.ROOT);
        int aliasStart = value.indexOf('(');
        if (aliasStart >= 0 && value.endsWith(")")) {
            String localized = value.substring(0, aliasStart).trim();
            String english = value.substring(aliasStart + 1, value.length() - 1).trim();
            String canonical = CANONICAL.get(english.toLowerCase(Locale.ROOT));
            if (canonical == null) canonical = CANONICAL.get(localized.toLowerCase(Locale.ROOT));
            if (canonical != null) return canonical;
        }
        return CANONICAL.getOrDefault(lower, value);
    }

    static boolean isSupported(String name) {
        String canonical = canonicalize(name);
        return CANONICAL.containsValue(canonical);
    }

    static Map<String, Integer> parse(String classesString) {
        Map<String, Integer> classes = new LinkedHashMap<>();
        if (classesString == null || classesString.isBlank()) return classes;
        for (String segment : classesString.split("/")) {
            String value = segment.trim();
            java.util.regex.Matcher matcher = LEVEL_SUFFIX.matcher(value);
            boolean hasLevel = matcher.find();
            String name = hasLevel ? value.substring(0, matcher.start()).trim() : value;
            if (!name.isEmpty()) {
                int level = hasLevel ? Integer.parseInt(matcher.group(1)) : 1;
                classes.merge(canonicalize(name), level, Integer::sum);
            }
        }
        return classes;
    }

    static String serialize(Map<String, Integer> classes, String fallback) {
        if (classes.isEmpty()) return fallback;
        return classes.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .map(entry -> canonicalize(entry.getKey()) + entry.getValue())
                .collect(java.util.stream.Collectors.joining("/"));
    }

    static String canonicalizeInput(String classesString) {
        if (classesString == null || classesString.isBlank()) return classesString;
        Map<String, Integer> classes = parse(classesString);
        for (String name : classes.keySet()) {
            if (!isSupported(name)) throw new com.dndadvlog.backend.exception.BusinessException("不支援的職業名稱：" + name);
        }
        return serialize(classes, classesString);
    }
}
