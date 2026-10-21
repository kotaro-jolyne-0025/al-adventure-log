package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdventureExportReadService {
    private final CharacterService characters;
    private final UserMapper users;
    private final AdventureEntryMapper entries;
    private final AdventureGainedItemMapper items;
    private final InventoryItemMapper inventory;
    private final AdventureEntryService adventures;

    public AdventureExportReadService(CharacterService characters, UserMapper users, AdventureEntryMapper entries,
            AdventureGainedItemMapper items, InventoryItemMapper inventory, AdventureEntryService adventures) {
        this.characters = characters;
        this.users = users;
        this.entries = entries;
        this.items = items;
        this.inventory = inventory;
        this.adventures = adventures;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdventureExportSnapshot read(UUID characterId, UUID userId) {
        CharacterResponse character = characters.getCharacter(characterId, userId);
        var user = users.findById(userId);
        if (user == null) throw new ResourceNotFoundException("找不到角色");
        character.setPlayerName(user.getDisplayName());
        character.setUserId(null);
        character.setAvatarUrl(null);
        // The existing list query owns sorting, ownership and complete activity/award collections.
        List<AdventureEntry> all = entries.findListSnapshot(characterId, userId).stream()
                .filter(e -> e.getId() != null).toList();
        if (all.isEmpty()) throw new BusinessException("尚無冒險紀錄可匯出");
        Map<UUID, List<AdventureGainedItem>> gained = items.findByOwnedCharacter(characterId, userId).stream()
                .collect(Collectors.groupingBy(AdventureGainedItem::getAdventureEntryId));
        boolean needsLegacy = all.stream().anyMatch(e -> !gained.containsKey(e.getId()));
        Map<UUID, List<InventoryItem>> legacy = needsLegacy
                ? inventory.findByCharacterId(characterId).stream()
                    .filter(i -> i.getAdventureEntryId() != null)
                    .sorted(Comparator.comparing(InventoryItem::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparing(InventoryItem::getId))
                    .collect(Collectors.groupingBy(InventoryItem::getAdventureEntryId))
                : Map.of();
        List<AdventureEntryResponse> responses = new ArrayList<>();
        for (int index = 0; index < all.size(); index++) {
            var entry = all.get(index);
            if (entry.getDowntimeActivities() == null || entry.getStoryAwards() == null) {
                throw new IllegalStateException("匯出子項目未完整載入");
            }
            var next = index + 1 < all.size() ? all.get(index + 1) : null;
            var response = adventures.toResponseWithContinuityWarning(entry,
                    next != null && next.getPlayDate() != null ? next : null);
            response.setGainedItems(gained.getOrDefault(entry.getId(), List.of()).stream()
                    .map(adventures::toGainedItemResponse).toList());
            response.setLegacyItems(response.getGainedItems().isEmpty()
                    ? legacy.getOrDefault(entry.getId(), List.of()).stream().map(InventoryItemService::toResponse).toList()
                    : List.of());
            List<String> warnings = new ArrayList<>(response.getWarnings());
            if (!response.getLegacyItems().isEmpty()
                    || (response.getGainedItems().isEmpty() && (entry.getRecordingModelVersion() == null || entry.getRecordingModelVersion() < 2))) {
                warnings.add("舊紀錄無完整物品快照；現存倉庫相容資料非完整歷史，原始獲得數量未知");
            }
            if (entry.getStartingLevel() != null && entry.getEndingLevel() != null
                    && entry.getEndingLevel() < entry.getStartingLevel()) warnings.add("歷史等級下降，請確認紀錄");
            response.setWarnings(List.copyOf(warnings));
            responses.add(response);
        }
        return new AdventureExportSnapshot(character, OffsetDateTime.now(ZoneId.of("Asia/Taipei")), List.copyOf(responses));
    }
}
