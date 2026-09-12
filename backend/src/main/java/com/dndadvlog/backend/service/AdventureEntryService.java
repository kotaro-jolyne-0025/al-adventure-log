package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.entity.DowntimeActivity;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdventureEntryService {

    private final AdventureEntryMapper entryMapper;
    private final CharacterMapper characterMapper;
    private final DowntimeActivityMapper downtimeActivityMapper;
    private final AdventureGainedItemMapper gainedItemMapper;
    private final CharacterService characterService;
    private final InventoryItemMapper inventoryItemMapper;

    public List<AdventureEntryResponse> getEntriesByCharacter(UUID characterId, UUID userId) {
        characterService.findCharacter(characterId, userId);
        List<AdventureEntry> entries = entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId);
        return entries.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public AdventureEntryResponse getEntry(UUID entryId, UUID userId) {
        return toResponse(findEntryAndVerifyOwner(entryId, userId));
    }

    public EntryDefaultsResponse getDefaults(UUID characterId, UUID userId) {
        EntryDefaultsResponse defaults = new EntryDefaultsResponse();
        characterService.findCharacter(characterId, userId);
        Optional<AdventureEntry> lastEntry =
                entryMapper.findFirstByCharacterIdOrderByPlayDateDescCreatedAtDesc(characterId);
        if (lastEntry.isPresent()) {
            AdventureEntry last = lastEntry.get();
            defaults.setStartingLevel(last.getEndingLevel());
            defaults.setStartingGold(last.getGoldTotal());
            defaults.setStartingDowntime(last.getDowntimeTotal());
            defaults.setStartingClassesString(last.getEndingClassesString());
        } else {
            Character character = characterService.findCharacter(characterId, userId);
            defaults.setStartingGold(BigDecimal.ZERO);
            defaults.setStartingDowntime(0);
            String classesStr = character.getCurrentClassesString();
            defaults.setStartingClassesString(classesStr);
            defaults.setStartingLevel(parseTotalLevelFromClassesString(classesStr));
        }

        // 魔法物品起始件數統一追隨倉庫中實際持有的永久魔法物品數量
        List<InventoryItem> permanentItems =
                inventoryItemMapper.findByCharacterIdAndItemType(characterId, "PERMANENT");
        int magicCount = permanentItems != null ? permanentItems.size() : 0;
        defaults.setStartingMagicItems(magicCount);

        return defaults;
    }

    private Integer parseTotalLevelFromClassesString(String classesString) {
        if (classesString == null || classesString.trim().isEmpty()) {
            return 1;
        }
        int total = 0;
        String[] segments = classesString.split("/");
        for (String seg : segments) {
            String trimmed = seg.trim();
            // Match trailing digits e.g. "戰士2" -> 2
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+)$").matcher(trimmed);
            if (matcher.find()) {
                try {
                    total += Integer.parseInt(matcher.group(1));
                } catch (NumberFormatException ignored) {}
            } else {
                total += 1;
            }
        }
        return total > 0 ? total : 1;
    }

    @Transactional
    public AdventureEntryResponse createEntry(UUID characterId, AdventureEntryRequest request, UUID userId) {
        validateResources(request);
        Character character = characterService.findCharacter(characterId, userId);
        AdventureEntry entry = new AdventureEntry();
        entry.setId(UUID.randomUUID());
        entry.setCharacterId(characterId);
        
        // 自動帶入先前的職業字串作為 starting (如果前端沒給，或者我們可以完全信任前端送的)
        if (request.getEndingClassesString() != null) {
            entry.setStartingClassesString(character.getCurrentClassesString());
            entry.setEndingClassesString(request.getEndingClassesString());
            
            // 更新角色當前的職業字串 (因為這是一筆新紀錄，它代表最新狀態)
            character.setCurrentClassesString(request.getEndingClassesString());
            characterMapper.update(character);
        }

        mapRequestToEntry(request, entry);
        entryMapper.insert(entry);
        
        log.info("冒險記錄建立: ID={}, 名稱={}", entry.getId(), entry.getAdventureName());
        return toResponse(findEntry(entry.getId()));
    }

    @Transactional
    public AdventureEntryResponse updateEntry(UUID entryId, AdventureEntryRequest request, UUID userId) {
        validateResources(request);
        AdventureEntry entry = findEntryAndVerifyOwner(entryId, userId);
        UUID characterId = entry.getCharacterId();
        
        // 為了簡單起見，如果這是「最新」的一筆紀錄，我們連帶更新 character 的 string
        Optional<AdventureEntry> lastEntry =
                entryMapper.findFirstByCharacterIdOrderByPlayDateDescCreatedAtDesc(characterId);
                
        if (request.getEndingClassesString() != null) {
            entry.setEndingClassesString(request.getEndingClassesString());
            if (lastEntry.isPresent() && lastEntry.get().getId().equals(entryId)) {
                Character character = characterService.findCharacter(characterId, userId);
                character.setCurrentClassesString(request.getEndingClassesString());
                characterMapper.update(character);
            }
        }

        mapRequestToEntry(request, entry);
        entryMapper.update(entry);

        log.info("冒險記錄更新: ID={}, 名稱={}", entryId, entry.getAdventureName());
        return toResponse(findEntry(entryId));
    }

    @Transactional
    public void deleteEntry(UUID entryId, UUID userId) {
        AdventureEntry entry = findEntryAndVerifyOwner(entryId, userId);
        UUID characterId = entry.getCharacterId();
        String fallbackString = entry.getStartingClassesString();

        entryMapper.deleteById(entryId);

        // 如果刪除的是最新一筆，角色狀態要退回上一筆
        Optional<AdventureEntry> latestRemaining =
                entryMapper.findFirstByCharacterIdOrderByPlayDateDescCreatedAtDesc(characterId);

        Character character = characterService.findCharacter(characterId, userId);
        if (latestRemaining.isPresent()) {
            character.setCurrentClassesString(latestRemaining.get().getEndingClassesString());
        } else {
            // 已無紀錄，回退至這筆紀錄建立前的狀態
            character.setCurrentClassesString(fallbackString);
        }
        characterMapper.update(character);
        
        log.info("冒險記錄刪除: ID={}", entryId);
    }

    public List<DowntimeActivityResponse> getActivities(UUID entryId, UUID userId) {
        findEntryAndVerifyOwner(entryId, userId);
        return downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(entryId)
                .stream().map(this::toActivityResponse).collect(Collectors.toList());
    }

    @Transactional
    public DowntimeActivityResponse createActivity(UUID entryId, DowntimeActivityRequest request, UUID userId) {
        findEntryAndVerifyOwner(entryId, userId);
        DowntimeActivity activity = new DowntimeActivity();
        activity.setId(UUID.randomUUID());
        activity.setAdventureEntryId(entryId);
        activity.setDescription(request.getDescription());
        downtimeActivityMapper.insert(activity);
        return toActivityResponse(findActivity(activity.getId()));
    }

    @Transactional
    public DowntimeActivityResponse updateActivity(UUID activityId, DowntimeActivityRequest request, UUID userId) {
        DowntimeActivity activity = findActivityAndVerifyOwner(activityId, userId);
        activity.setDescription(request.getDescription());
        downtimeActivityMapper.update(activity);
        return toActivityResponse(findActivity(activityId));
    }

    @Transactional
    public void deleteActivity(UUID activityId, UUID userId) {
        findActivityAndVerifyOwner(activityId, userId);
        downtimeActivityMapper.deleteById(activityId);
    }

    // ── 冒險獲得物品快照 (Gained Items Snapshot) ──────────────────────────────

    public List<AdventureGainedItemResponse> getGainedItems(UUID entryId, UUID userId) {
        findEntryAndVerifyOwner(entryId, userId);
        return gainedItemMapper.findByAdventureEntryId(entryId)
                .stream().map(this::toGainedItemResponse).collect(Collectors.toList());
    }

    @Transactional
    public AdventureGainedItemResponse createGainedItem(UUID entryId, AdventureGainedItemRequest request, UUID userId) {
        findEntryAndVerifyOwner(entryId, userId);
        AdventureGainedItem item = new AdventureGainedItem();
        item.setId(UUID.randomUUID());
        item.setAdventureEntryId(entryId);
        item.setItemName(request.getItemName());
        item.setItemType(request.getItemType());
        item.setRarity(request.getRarity());
        item.setQuantity(request.getQuantity() != null ? request.getQuantity() : 1);
        item.setNotes(request.getNotes());
        gainedItemMapper.insert(item);
        return toGainedItemResponse(gainedItemMapper.findById(item.getId()));
    }

    @Transactional
    public AdventureGainedItemResponse updateGainedItem(UUID entryId, UUID itemId, AdventureGainedItemRequest request, UUID userId) {
        AdventureEntry entry = findEntryAndVerifyOwner(entryId, userId);
        AdventureGainedItem snapshot = gainedItemMapper.findById(itemId);
        if (snapshot == null) {
            throw new ResourceNotFoundException("找不到獲得物品快照 ID: " + itemId);
        }

        int oldQty = snapshot.getQuantity() != null ? snapshot.getQuantity() : 1;
        int newQty = request.getQuantity() != null ? request.getQuantity() : 1;
        int delta = newQty - oldQty;

        // 1. 更新快照表記錄
        snapshot.setItemName(request.getItemName());
        snapshot.setItemType(request.getItemType());
        snapshot.setRarity(request.getRarity());
        snapshot.setQuantity(newQty);
        snapshot.setNotes(request.getNotes());
        gainedItemMapper.update(snapshot);

        // 2. 精準同步倉庫背包 (方案 A: 增量差額 Delta Sync)
        InventoryItem warehouseItem = inventoryItemMapper.findByAdventureGainedItemId(itemId);
        if (warehouseItem != null) {
            warehouseItem.setItemName(request.getItemName());
            warehouseItem.setRarity(parseRarity(request.getRarity()));
            warehouseItem.setNotes(request.getNotes());

            if ("CONSUMABLE".equalsIgnoreCase(request.getItemType())) {
                int targetQty = Math.max(0, warehouseItem.getQuantity() + delta);
                if (targetQty <= 0) {
                    inventoryItemMapper.deleteById(warehouseItem.getId());
                } else {
                    warehouseItem.setQuantity(targetQty);
                    inventoryItemMapper.update(warehouseItem);
                }
            } else {
                inventoryItemMapper.update(warehouseItem);
            }
        } else if ("CONSUMABLE".equalsIgnoreCase(request.getItemType()) && delta > 0) {
            // 若原先已在倉庫喝完 (0 瓶已移除)，但編輯後數量調高 (+delta)，則在倉庫為其補發 delta 瓶！
            InventoryItem newItem = new InventoryItem();
            newItem.setId(UUID.randomUUID());
            newItem.setCharacterId(entry.getCharacterId());
            newItem.setAdventureEntryId(entryId);
            newItem.setAdventureGainedItemId(itemId);
            newItem.setItemName(request.getItemName());
            newItem.setItemType(InventoryItem.ItemType.CONSUMABLE);
            newItem.setRarity(parseRarity(request.getRarity()));
            newItem.setQuantity(delta);
            newItem.setSource(entry.getAdventureName() != null ? entry.getAdventureName() : "冒險獲得");
            newItem.setNotes(request.getNotes());
            inventoryItemMapper.insert(newItem);
        }

        return toGainedItemResponse(gainedItemMapper.findById(itemId));
    }

    @Transactional
    public void deleteGainedItem(UUID itemId, UUID userId) {
        AdventureGainedItem item = findGainedItemAndVerifyOwner(itemId, userId);
        AdventureEntry entry = findEntry(item.getAdventureEntryId());
        InventoryItem warehouseItem = inventoryItemMapper.findByAdventureGainedItemId(itemId);
        if (warehouseItem != null) {
            inventoryItemMapper.deleteById(warehouseItem.getId());
        }
        gainedItemMapper.deleteById(itemId);
    }

    private InventoryItem.Rarity parseRarity(String rarityStr) {
        if (rarityStr == null || rarityStr.trim().isEmpty()) {
            return null;
        }
        try {
            return InventoryItem.Rarity.valueOf(rarityStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void validateResources(AdventureEntryRequest request) {
        if (request.getStartingGold() != null && request.getStartingGold().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("起始金幣不得為負數");
        }
        if (request.getStartingDowntime() != null && request.getStartingDowntime() < 0) {
            throw new BusinessException("起始休整期天數不得為負數");
        }
        if (request.getStartingMagicItems() != null && request.getStartingMagicItems() < 0) {
            throw new BusinessException("起始魔法物品數量不得為負數");
        }

        BigDecimal goldTotal = calcTotal(request.getStartingGold(), request.getGoldChange(), request.getGoldDowntimeChange());
        if (goldTotal != null && goldTotal.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("金幣合計不得為負數");
        }

        Integer downtimeTotal = calcTotalInt(request.getStartingDowntime(), request.getDowntimeChange(), request.getDowntimeDowntimeChange());
        if (downtimeTotal != null && downtimeTotal < 0) {
            throw new BusinessException("休整期天數合計不得為負數");
        }

        Integer magicItemsTotal = calcTotalInt(request.getStartingMagicItems(), request.getMagicItemsChange(), request.getMagicItemsDowntimeChange());
        if (magicItemsTotal != null && magicItemsTotal < 0) {
            throw new BusinessException("魔法物品合計不得為負數");
        }
    }

    private BigDecimal calcTotal(BigDecimal starting, BigDecimal change, BigDecimal downtimeChange) {
        if (starting == null && change == null && downtimeChange == null) return null;
        BigDecimal s = starting != null ? starting : BigDecimal.ZERO;
        BigDecimal c = change != null ? change : BigDecimal.ZERO;
        BigDecimal d = downtimeChange != null ? downtimeChange : BigDecimal.ZERO;
        return s.add(c).add(d);
    }

    private Integer calcTotalInt(Integer starting, Integer change, Integer downtimeChange) {
        if (starting == null && change == null && downtimeChange == null) return null;
        int s = starting != null ? starting : 0;
        int c = change != null ? change : 0;
        int d = downtimeChange != null ? downtimeChange : 0;
        return s + c + d;
    }

    private void mapRequestToEntry(AdventureEntryRequest request, AdventureEntry entry) {
        entry.setAdventureCode(request.getAdventureCode());
        entry.setAdventureName(request.getAdventureName());
        entry.setPlayDate(request.getPlayDate());
        entry.setDmName(request.getDmName());
        entry.setStartingLevel(request.getStartingLevel());
        entry.setEndingLevel(request.getEndingLevel());
        entry.setStartingGold(request.getStartingGold());
        entry.setGoldChange(request.getGoldChange());
        entry.setGoldDowntimeChange(request.getGoldDowntimeChange());
        entry.setGoldTotal(calcTotal(request.getStartingGold(), request.getGoldChange(), request.getGoldDowntimeChange()));
        entry.setStartingDowntime(request.getStartingDowntime());
        entry.setDowntimeChange(request.getDowntimeChange());
        entry.setDowntimeDowntimeChange(request.getDowntimeDowntimeChange());
        entry.setDowntimeTotal(calcTotalInt(request.getStartingDowntime(), request.getDowntimeChange(), request.getDowntimeDowntimeChange()));
        entry.setStartingMagicItems(request.getStartingMagicItems());
        entry.setMagicItemsChange(request.getMagicItemsChange());
        entry.setMagicItemsDowntimeChange(request.getMagicItemsDowntimeChange());
        entry.setMagicItemsTotal(calcTotalInt(request.getStartingMagicItems(), request.getMagicItemsChange(), request.getMagicItemsDowntimeChange()));
        entry.setAdventureNotes(request.getAdventureNotes());
        entry.setSoulCoinChargesUsed(request.getSoulCoinChargesUsed());
    }

    private AdventureEntry findEntry(UUID entryId) {
        AdventureEntry entry = entryMapper.findById(entryId);
        if (entry == null) throw new ResourceNotFoundException("找不到冒險記錄 ID：" + entryId);
        entry.setDowntimeActivities(downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(entryId));
        return entry;
    }

    private AdventureEntry findEntryAndVerifyOwner(UUID entryId, UUID userId) {
        AdventureEntry entry = findEntry(entryId);
        characterService.findCharacter(entry.getCharacterId(), userId);
        return entry;
    }

    private DowntimeActivity findActivity(UUID activityId) {
        DowntimeActivity activity = downtimeActivityMapper.findById(activityId);
        if (activity == null) throw new ResourceNotFoundException("找不到休整期活動 ID：" + activityId);
        return activity;
    }

    private DowntimeActivity findActivityAndVerifyOwner(UUID activityId, UUID userId) {
        DowntimeActivity activity = findActivity(activityId);
        findEntryAndVerifyOwner(activity.getAdventureEntryId(), userId);
        return activity;
    }

    private AdventureGainedItem findGainedItemAndVerifyOwner(UUID itemId, UUID userId) {
        AdventureGainedItem item = gainedItemMapper.findById(itemId);
        if (item == null) {
            throw new ResourceNotFoundException("找不到獲得物品快照 ID: " + itemId);
        }
        findEntryAndVerifyOwner(item.getAdventureEntryId(), userId);
        return item;
    }

    private AdventureEntryResponse toResponse(AdventureEntry entry) {
        AdventureEntryResponse response = new AdventureEntryResponse();
        response.setId(entry.getId());
        response.setCharacterId(entry.getCharacterId());
        response.setAdventureCode(entry.getAdventureCode());
        response.setAdventureName(entry.getAdventureName());
        response.setPlayDate(entry.getPlayDate());
        response.setDmName(entry.getDmName());
        response.setStartingLevel(entry.getStartingLevel());
        response.setEndingLevel(entry.getEndingLevel());
        response.setStartingGold(entry.getStartingGold());
        response.setGoldChange(entry.getGoldChange());
        response.setGoldDowntimeChange(entry.getGoldDowntimeChange());
        response.setGoldTotal(entry.getGoldTotal());
        response.setStartingDowntime(entry.getStartingDowntime());
        response.setDowntimeChange(entry.getDowntimeChange());
        response.setDowntimeDowntimeChange(entry.getDowntimeDowntimeChange());
        response.setDowntimeTotal(entry.getDowntimeTotal());
        response.setStartingMagicItems(entry.getStartingMagicItems());
        response.setMagicItemsChange(entry.getMagicItemsChange());
        response.setMagicItemsDowntimeChange(entry.getMagicItemsDowntimeChange());
        response.setMagicItemsTotal(entry.getMagicItemsTotal());
        
        response.setStartingClassesString(entry.getStartingClassesString());
        response.setEndingClassesString(entry.getEndingClassesString());
        
        response.setAdventureNotes(entry.getAdventureNotes());
        response.setSoulCoinChargesUsed(entry.getSoulCoinChargesUsed());
        response.setCreatedAt(entry.getCreatedAt());
        response.setUpdatedAt(entry.getUpdatedAt());
        response.setDowntimeActivities(entry.getDowntimeActivities()
                .stream().map(this::toActivityResponse).collect(Collectors.toList()));
        return response;
    }

    private DowntimeActivityResponse toActivityResponse(DowntimeActivity activity) {
        DowntimeActivityResponse response = new DowntimeActivityResponse();
        response.setId(activity.getId());
        response.setAdventureEntryId(activity.getAdventureEntryId());
        response.setDescription(activity.getDescription());
        response.setCreatedAt(activity.getCreatedAt());
        response.setUpdatedAt(activity.getUpdatedAt());
        return response;
    }

    private AdventureGainedItemResponse toGainedItemResponse(AdventureGainedItem item) {
        AdventureGainedItemResponse response = new AdventureGainedItemResponse();
        response.setId(item.getId());
        response.setAdventureEntryId(item.getAdventureEntryId());
        response.setItemName(item.getItemName());
        response.setItemType(item.getItemType());
        response.setRarity(item.getRarity());
        response.setQuantity(item.getQuantity());
        response.setNotes(item.getNotes());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }
}