package com.dndadvlog.backend.service;

import com.dndadvlog.backend.entity.AdventureEntry;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

record AdventureContribution(Map<String, Integer> classes, BigDecimal gold, int downtime) {
    static final AdventureContribution EMPTY = new AdventureContribution(Map.of(), BigDecimal.ZERO, 0);

    static AdventureContribution from(AdventureEntry entry) {
        Map<String, Integer> starting = DndClassNames.parse(entry.getStartingClassesString());
        Map<String, Integer> ending = DndClassNames.parse(entry.getEndingClassesString());
        Map<String, Integer> classChanges = new LinkedHashMap<>();
        ending.forEach((name, level) -> {
            int difference = level - starting.getOrDefault(name, 0);
            if (difference != 0) classChanges.put(name, difference);
        });
        starting.forEach((name, level) -> {
            if (!ending.containsKey(name)) classChanges.put(name, -level);
        });

        BigDecimal gold = zero(entry.getGoldChange()).add(zero(entry.getGoldDowntimeChange()));
        if (entry.getGoldChange() == null && entry.getGoldDowntimeChange() == null
                && entry.getStartingGold() != null && entry.getGoldTotal() != null) {
            gold = entry.getGoldTotal().subtract(entry.getStartingGold());
        }
        int downtime = zero(entry.getDowntimeChange()) + zero(entry.getDowntimeDowntimeChange());
        if (entry.getDowntimeChange() == null && entry.getDowntimeDowntimeChange() == null
                && entry.getStartingDowntime() != null && entry.getDowntimeTotal() != null) {
            downtime = entry.getDowntimeTotal() - entry.getStartingDowntime();
        }
        return new AdventureContribution(classChanges, gold, downtime);
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static int zero(Integer value) {
        return value == null ? 0 : value;
    }
}
