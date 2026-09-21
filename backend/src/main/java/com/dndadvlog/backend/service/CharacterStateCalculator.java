package com.dndadvlog.backend.service;

import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.exception.BusinessException;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CharacterStateCalculator {
    private CharacterStateCalculator() {}

    static State fromOpeningBaseline(
            String classesString, BigDecimal gold, Integer downtime, List<AdventureEntry> entries) {
        Map<String, Integer> classes = new LinkedHashMap<>(DndClassNames.parse(classesString));
        BigDecimal totalGold = gold == null ? BigDecimal.ZERO : gold;
        int totalDowntime = downtime == null ? 0 : downtime;

        for (AdventureEntry entry : entries) {
            AdventureContribution contribution = AdventureContribution.from(entry);
            contribution.classes().forEach((name, amount) -> classes.merge(name, amount, Integer::sum));
            totalGold = totalGold.add(contribution.gold());
            totalDowntime += contribution.downtime();
        }

        classes.entrySet().removeIf(entry -> entry.getValue() == 0);
        if (classes.values().stream().anyMatch(level -> level < 0)) {
            throw new BusinessException("這組開卡職業會使目前職業等級低於 0，請調整開卡資料或相關冒險紀錄");
        }
        if (classes.values().stream().mapToInt(Integer::intValue).sum() > 20) {
            throw new BusinessException("重新計算後角色總等級不得超過 20，請調整開卡資料或相關冒險紀錄");
        }
        return new State(
                DndClassNames.serialize(classes, classes.isEmpty() ? null : classesString),
                totalGold,
                totalDowntime);
    }

    record State(String classesString, BigDecimal gold, Integer downtime) {}
}
