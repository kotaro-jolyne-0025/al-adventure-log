package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureEntryRequest;
import com.dndadvlog.backend.dto.AdventureEntryResponse;
import com.dndadvlog.backend.dto.AdventureEntrySaveRequest;
import com.dndadvlog.backend.dto.AdventureGainedItemRequest;
import com.dndadvlog.backend.dto.AdventureGainedItemResponse;
import com.dndadvlog.backend.dto.ClassLevelChangeRequest;
import com.dndadvlog.backend.dto.DowntimeActivityRequest;
import com.dndadvlog.backend.dto.DowntimeActivityResponse;
import com.dndadvlog.backend.dto.EntryDefaultsResponse;
import com.dndadvlog.backend.dto.StoryAwardRequest;
import com.dndadvlog.backend.dto.StoryAwardResponse;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.entity.DowntimeActivity;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.entity.StoryAward;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdventureEntryService {

    private static final Pattern CLASS_LEVEL_PATTERN = Pattern.compile("(\\d++)$");

    private final AdventureEntryMapper entryMapper;
    private final CharacterMapper characterMapper;
    private final DowntimeActivityMapper downtimeActivityMapper;
    private final AdventureGainedItemMapper gainedItemMapper;
    private final StoryAwardMapper storyAwardMapper;
    private final CharacterService characterService;
    private final InventoryItemMapper inventoryItemMapper;

    public List<AdventureEntryResponse> getEntriesByCharacter(UUID characterId, UUID userId) {
        characterService.findCharacter(characterId, userId);
        List<AdventureEntry> entries = entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId);

        if (entries.isEmpty()) {
            return List.of();
        }

        List<UUID> entryIds = entries.stream().map(AdventureEntry::getId).toList();
        Map<UUID, List<DowntimeActivity>> activitiesByEntry = downtimeActivityMapper.findByEntryIds(entryIds)
                .stream()
                .collect(Collectors.groupingBy(DowntimeActivity::getAdventureEntryId));
        Map<UUID, List<StoryAward>> awardsByEntry = storyAwardMapper.findByAdventureEntryIds(entryIds)
                .stream()
                .collect(Collectors.groupingBy(StoryAward::getAdventureEntryId));

        entries.forEach(entry -> {
            entry.setDowntimeActivities(activitiesByEntry.getOrDefault(entry.getId(), List.of()));
            entry.setStoryAwards(awardsByEntry.getOrDefault(entry.getId(), List.of()));
        });
        return entries.stream().map(this::toResponse).toList();
    }

    public AdventureEntryResponse getEntry(UUID entryId, UUID userId) {
        return toResponseWithContinuityWarning(findEntryAndVerifyOwner(entryId, userId));
    }

    public EntryDefaultsResponse getDefaults(UUID characterId, UUID userId) {
        EntryDefaultsResponse defaults = new EntryDefaultsResponse();
        Character character = characterService.findCharacter(characterId, userId);
        defaults.setStartingClassesString(DndClassNames.serialize(
                DndClassNames.parse(character.getCurrentClassesString()), character.getCurrentClassesString()));
        defaults.setStartingLevel(parseTotalLevelFromClassesString(character.getCurrentClassesString()));
        defaults.setStartingGold(orZero(character.getCurrentGold()));
        defaults.setStartingDowntime(orZero(character.getCurrentDowntime()));
        defaults.setStartingMagicItems(orZero(character.getCurrentMagicItems()));

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
            java.util.regex.Matcher matcher = CLASS_LEVEL_PATTERN.matcher(trimmed);
            if (matcher.find()) {
                try {
                    total += Integer.parseInt(matcher.group(1));
                } catch (NumberFormatException ignored) {
                    // 非法數字格式則略過並於後續預設加 1
                }
            } else {
                total += 1;
            }
        }
        return total > 0 ? total : 1;
    }

    @Transactional
    public AdventureEntryResponse createEntry(UUID characterId, AdventureEntryRequest request, UUID userId) {
        if (positiveMagicItemChanges(request) > 0) {
            throw new BusinessException("正數魔法物品變動必須透過完整儲存提供物品明細");
        }
        return createEntryInternal(characterId, request, userId);
    }

    private AdventureEntryResponse createEntryInternal(UUID characterId, AdventureEntryRequest request, UUID userId) {
        Character character = characterService.findCharacter(characterId, userId);
        boolean isFirstEntry = !entryMapper.existsByCharacterId(characterId);
        AdventureEntry entry = new AdventureEntry();
        entry.setId(UUID.randomUUID());
        entry.setCharacterId(characterId);
        entry.setRecordingModelVersion(2);
        mapDescriptiveFields(request, entry);
        AdventureEntry previous = request.getPlayDate() == null ? null
                : entryMapper.findPreviousForNew(characterId, request.getPlayDate());
        calculateSnapshot(entry, request, character, previous);
        validateSnapshot(entry);
        entryMapper.insert(entry);

        if (isFirstEntry) {
            applyFirstEntrySnapshot(character, entry);
        } else {
            applyContributionDifference(character, AdventureContribution.EMPTY, contributionOf(entry));
        }
        characterMapper.update(character);
        reconcileMagicItemDetails(entry);

        log.info("冒險記錄建立: ID={}, 名稱={}", entry.getId(), entry.getAdventureName());
        AdventureEntry saved = findEntry(entry.getId());
        return toResponseWithContinuityWarning(saved);
    }

    @Transactional
    public AdventureEntryResponse updateEntry(UUID entryId, AdventureEntryRequest request, UUID userId) {
        return updateEntryInternal(entryId, request, userId, true);
    }

    private AdventureEntryResponse updateEntryInternal(
            UUID entryId, AdventureEntryRequest request, UUID userId, boolean validateExistingDetails) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        if (validateExistingDetails && hasLedgerInput(request)) {
            int actual = gainedItemMapper.findByAdventureEntryId(entryId).stream()
                    .filter(item -> !Boolean.TRUE.equals(item.getNeedsDetails()))
                    .mapToInt(item -> "CONSUMABLE".equalsIgnoreCase(item.getItemType())
                            ? (item.getQuantity() != null ? item.getQuantity() : 1) : 1)
                    .sum();
            if (actual != positiveMagicItemChanges(request)) {
                throw new BusinessException("魔法物品變動數量必須與物品明細相同，請使用完整儲存提供明細");
            }
        }
        AdventureContribution oldContribution = contributionOf(entry);
        Character character = characterService.findCharacter(entry.getCharacterId(), userId);
        mapDescriptiveFields(request, entry);

        if (hasLedgerInput(request)) {
            AdventureEntry previous = request.getPlayDate() == null ? null
                    : entryMapper.findPreviousForExisting(
                            entry.getCharacterId(), request.getPlayDate(), entry.getCreatedAt(), entry.getId());
            calculateSnapshot(entry, request, character, previous);
            validateSnapshot(entry);
            applyContributionDifference(character, oldContribution, contributionOf(entry));
            characterMapper.update(character);
        }
        entryMapper.update(entry);
        if (hasLedgerInput(request)) {
            reconcileMagicItemDetails(entry);
        }

        log.info("冒險記錄更新: ID={}, 名稱={}", entryId, entry.getAdventureName());
        return toResponseWithContinuityWarning(findEntry(entryId));
    }

    @Transactional
    public AdventureEntryResponse createEntryWithDetails(
            UUID characterId, AdventureEntrySaveRequest request, UUID userId) {
        validateMagicItemDetails(request, positiveMagicItemChanges(request.getEntry()));
        AdventureEntryResponse created = createEntryInternal(characterId, request.getEntry(), userId);
        syncEntryDetails(created.getId(), request, userId);
        AdventureEntry entry = findOwnedEntry(created.getId(), userId);
        reconcileMagicItemDetails(entry);
        refreshCurrentMagicItems(characterId);
        return toResponseWithContinuityWarning(findEntry(created.getId()));
    }

    @Transactional
    public AdventureEntryResponse updateEntryWithDetails(
            UUID entryId, AdventureEntrySaveRequest request, UUID userId) {
        AdventureEntry original = findOwnedEntry(entryId, userId);
        validateMagicItemDetails(request, hasLedgerInput(request.getEntry())
                ? positiveMagicItemChanges(request.getEntry())
                : Math.max(0, orZero(original.getMagicItemsChange()))
                        + Math.max(0, orZero(original.getMagicItemsDowntimeChange())));
        // Resolve unlinked legacy provenance against the original title/code before
        // the main record is renamed. These writes share the outer transaction.
        findOwnedEntry(entryId, userId);
        Set<UUID> existingIds = gainedItemMapper.findByAdventureEntryId(entryId).stream()
                .map(AdventureGainedItem::getId).collect(Collectors.toSet());
        for (AdventureGainedItemRequest item : request.getGainedItems()) {
            if (item.getId() != null && !existingIds.contains(item.getId())) {
                updateGainedItem(entryId, item.getId(), item, userId);
                existingIds.add(item.getId());
            }
        }
        updateEntryInternal(entryId, request.getEntry(), userId, false);
        syncEntryDetails(entryId, request, userId);
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        if (hasLedgerInput(request.getEntry())) {
            reconcileMagicItemDetails(entry);
        }
        refreshCurrentMagicItems(entry.getCharacterId());
        return toResponseWithContinuityWarning(findEntry(entryId));
    }

    @Transactional
    public void deleteEntry(UUID entryId, UUID userId) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        Character character = characterService.findCharacter(entry.getCharacterId(), userId);
        entryMapper.deleteById(entryId);
        applyContributionDifference(character, contributionOf(entry), AdventureContribution.EMPTY);
        characterMapper.update(character);
        refreshCurrentMagicItems(entry.getCharacterId());

        log.info("冒險記錄刪除: ID={}", entryId);
    }

    public List<DowntimeActivityResponse> getActivities(UUID entryId, UUID userId) {
        findOwnedEntry(entryId, userId);
        return downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(entryId)
                .stream().map(this::toActivityResponse).toList();
    }

    @Transactional
    public DowntimeActivityResponse createActivity(UUID entryId, DowntimeActivityRequest request, UUID userId) {
        findOwnedEntry(entryId, userId);
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
        findOwnedEntry(entryId, userId);
        return gainedItemMapper.findByAdventureEntryId(entryId)
                .stream().map(this::toGainedItemResponse).toList();
    }

    @Transactional
    public AdventureGainedItemResponse createGainedItem(UUID entryId, AdventureGainedItemRequest request, UUID userId) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        UUID itemId = createGainedItemWithWarehouse(entry, request, AcquisitionSource.ADVENTURE, false);
        refreshCurrentMagicItems(entry.getCharacterId());
        return toGainedItemResponse(gainedItemMapper.findById(itemId));
    }

    @Transactional
    public AdventureGainedItemResponse updateGainedItem(UUID entryId, UUID itemId, AdventureGainedItemRequest request, UUID userId) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        AdventureGainedItem snapshot = gainedItemMapper.findById(itemId);

        if (snapshot != null && !entryId.equals(snapshot.getAdventureEntryId())) {
            throw new ResourceNotFoundException("找不到此冒險記錄的獲得物品 ID: " + itemId);
        }
        
        // 容錯處理：若傳入的 itemId 找不到快照（例如前端載入自舊版歷史倉庫資料）
        if (snapshot == null) {
            InventoryItem existingWarehouse = inventoryItemMapper.findById(itemId);
            if (isLegacyWarehouseForEntry(existingWarehouse, entry)) {
                snapshot = new AdventureGainedItem();
                snapshot.setId(itemId);
                snapshot.setAdventureEntryId(entryId);
                snapshot.setItemName(request.getItemName());
                snapshot.setItemType(request.getItemType());
                snapshot.setRarity(request.getRarity());
                snapshot.setItemCategory(request.getItemCategory());
                snapshot.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
                snapshot.setQuantity(request.getQuantity() != null ? request.getQuantity() : 1);
                snapshot.setAcquisitionSource(AcquisitionSource.ADVENTURE);
                snapshot.setNeedsDetails(false);
                snapshot.setNotes(request.getNotes());
                gainedItemMapper.insert(snapshot);

                existingWarehouse.setAdventureGainedItemId(itemId);
                existingWarehouse.setAdventureEntryId(entryId);
                existingWarehouse.setItemName(request.getItemName());
                existingWarehouse.setRarity(parseRarity(request.getRarity()));
                existingWarehouse.setItemCategory(request.getItemCategory());
                existingWarehouse.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
                existingWarehouse.setAcquisitionSource(AcquisitionSource.ADVENTURE);
                existingWarehouse.setNeedsDetails(false);
                existingWarehouse.setNotes(request.getNotes());
                if (request.getQuantity() != null) {
                    existingWarehouse.setQuantity(request.getQuantity());
                }
                inventoryItemMapper.update(existingWarehouse);
                refreshCurrentMagicItems(entry.getCharacterId());
                log.info("為歷史道具補建快照並同步倉庫: 道具={}, EntryID={}", request.getItemName(), entryId);
                return toGainedItemResponse(snapshot);
            } else {
                throw new ResourceNotFoundException("找不到獲得物品快照 ID: " + itemId);
            }
        }

        int oldQty = snapshot.getQuantity() != null ? snapshot.getQuantity().intValue() : 1;
        int newQty = request.getQuantity() != null ? request.getQuantity().intValue() : 1;
        int delta = newQty - oldQty;
        String oldSnapshotName = snapshot.getItemName();

        // 1. 更新快照表記錄
        snapshot.setItemName(request.getItemName());
        snapshot.setItemType(request.getItemType());
        snapshot.setRarity(request.getRarity());
        snapshot.setItemCategory(request.getItemCategory());
        snapshot.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
        snapshot.setQuantity(newQty);
        if (snapshot.getAcquisitionSource() == null) {
            snapshot.setAcquisitionSource(AcquisitionSource.ADVENTURE);
        }
        if (Boolean.TRUE.equals(snapshot.getNeedsDetails())
                && !"未命名魔法物品".equals(request.getItemName().trim())) {
            snapshot.setNeedsDetails(false);
        }
        snapshot.setNotes(request.getNotes());
        gainedItemMapper.update(snapshot);

        // 2. 精準同步倉庫背包 (Direct + Fallback Sync)
        InventoryItem warehouseItem = inventoryItemMapper.findByAdventureGainedItemId(itemId);
        
        // 若以 gainedItemId 找不到，嘗試以 (adventureEntryId + 歷史相同 item_name) 關聯
        if (warehouseItem == null) {
            List<InventoryItem> entryItems = inventoryItemMapper.findByAdventureEntryId(entryId);
            warehouseItem = entryItems.stream()
                .filter(i -> i.getAdventureGainedItemId() == null && (
                    (oldSnapshotName != null && oldSnapshotName.equalsIgnoreCase(i.getItemName())) ||
                    request.getItemName().equalsIgnoreCase(i.getItemName())
                ))
                .findFirst().orElse(null);
            if (warehouseItem != null) {
                warehouseItem.setAdventureGainedItemId(itemId);
            }
        }

        if (warehouseItem != null) {
            // 即時同步名稱、稀有度、同調、備註
            warehouseItem.setItemName(request.getItemName());
            warehouseItem.setRarity(parseRarity(request.getRarity()));
            warehouseItem.setItemCategory(request.getItemCategory());
            warehouseItem.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
            warehouseItem.setAcquisitionSource(snapshot.getAcquisitionSource());
            warehouseItem.setNeedsDetails(snapshot.getNeedsDetails());
            warehouseItem.setNotes(request.getNotes());

            int targetQty = Math.max(0, orZero(warehouseItem.getQuantity()) + delta);
            if (targetQty <= 0) {
                inventoryItemMapper.deleteById(warehouseItem.getId());
            } else {
                warehouseItem.setQuantity(targetQty);
                inventoryItemMapper.update(warehouseItem);
            }
            log.info("已同步更新倉庫物品: ID={}, 名稱={}, 需同調={}", warehouseItem.getId(), warehouseItem.getItemName(), warehouseItem.getRequiresAttunement());
        } else if (delta > 0) {
            // 已消耗或刪除的歷史物品只補入新增差額；數量不變時不得補貨。
            InventoryItem newItem = new InventoryItem();
            newItem.setId(UUID.randomUUID());
            newItem.setCharacterId(entry.getCharacterId());
            newItem.setAdventureEntryId(entryId);
            newItem.setAdventureGainedItemId(itemId);
            newItem.setItemName(request.getItemName());
            newItem.setItemType(parseItemType(request.getItemType()));
            newItem.setRarity(parseRarity(request.getRarity()));
            newItem.setItemCategory(request.getItemCategory());
            newItem.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
            newItem.setQuantity(delta);
            newItem.setAcquisitionSource(snapshot.getAcquisitionSource());
            newItem.setNeedsDetails(snapshot.getNeedsDetails());
            newItem.setSource(entry.getAdventureName() != null ? entry.getAdventureName() : "冒險獲得");
            newItem.setNotes(request.getNotes());
            inventoryItemMapper.insert(newItem);
            log.info("倉庫物品自動補建並綁定快照: ID={}, 名稱={}", newItem.getId(), newItem.getItemName());
        }

        refreshCurrentMagicItems(entry.getCharacterId());
        return toGainedItemResponse(gainedItemMapper.findById(itemId));
    }

    @Transactional
    public void deleteGainedItem(UUID itemId, UUID userId) {
        AdventureGainedItem snapshot = findGainedItemAndVerifyOwner(itemId, userId);
        AdventureEntry entry = findOwnedEntry(snapshot.getAdventureEntryId(), userId);
        InventoryItem warehouseItem = inventoryItemMapper.findByAdventureGainedItemId(itemId);
        if (warehouseItem != null) {
            inventoryItemMapper.deleteById(warehouseItem.getId());
        }
        gainedItemMapper.deleteById(itemId);
        refreshCurrentMagicItems(entry.getCharacterId());
    }

    private InventoryItem.ItemType parseItemType(String itemTypeStr) {
        if ("CONSUMABLE".equalsIgnoreCase(itemTypeStr)) {
            return InventoryItem.ItemType.CONSUMABLE;
        }
        return InventoryItem.ItemType.PERMANENT;
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

    private void syncEntryDetails(UUID entryId, AdventureEntrySaveRequest request, UUID userId) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        syncDowntimeActivities(entryId, request.getDowntimeActivities());
        syncGainedItems(entry, request.getGainedItems(), userId);
        syncStoryAwards(entryId, request.getStoryAwards());
    }

    private void syncDowntimeActivities(UUID entryId, List<DowntimeActivityRequest> requests) {
        Map<UUID, DowntimeActivity> existingById = downtimeActivityMapper
                .findByEntryIdOrderByCreatedAtAsc(entryId)
                .stream()
                .collect(Collectors.toMap(DowntimeActivity::getId, Function.identity()));
        Set<UUID> submittedIds = requests.stream()
                .map(DowntimeActivityRequest::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        if (!existingById.keySet().containsAll(submittedIds)) {
            throw new ResourceNotFoundException("休整期活動不屬於此冒險記錄");
        }

        existingById.keySet().stream()
                .filter(id -> !submittedIds.contains(id))
                .forEach(downtimeActivityMapper::deleteById);

        for (DowntimeActivityRequest childRequest : requests) {
            if (childRequest.getId() == null) {
                DowntimeActivity activity = new DowntimeActivity();
                activity.setId(UUID.randomUUID());
                activity.setAdventureEntryId(entryId);
                activity.setDescription(childRequest.getDescription().trim());
                downtimeActivityMapper.insert(activity);
            } else {
                DowntimeActivity activity = existingById.get(childRequest.getId());
                activity.setDescription(childRequest.getDescription().trim());
                downtimeActivityMapper.update(activity);
            }
        }
    }

    private void syncStoryAwards(UUID entryId, List<StoryAwardRequest> requests) {
        Map<UUID, StoryAward> existingById = storyAwardMapper.findByAdventureEntryId(entryId)
                .stream()
                .collect(Collectors.toMap(StoryAward::getId, Function.identity()));
        Set<UUID> submittedIds = requests.stream()
                .map(StoryAwardRequest::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        if (!existingById.keySet().containsAll(submittedIds)) {
            throw new ResourceNotFoundException("故事獎勵不屬於此冒險記錄");
        }

        existingById.keySet().stream()
                .filter(id -> !submittedIds.contains(id))
                .forEach(storyAwardMapper::deleteById);

        for (StoryAwardRequest childRequest : requests) {
            if (childRequest.getId() == null) {
                StoryAward award = new StoryAward();
                award.setId(UUID.randomUUID());
                award.setAdventureEntryId(entryId);
                award.setAwardName(childRequest.getAwardName().trim());
                award.setDescription(trimToNull(childRequest.getDescription()));
                storyAwardMapper.insert(award);
            } else {
                StoryAward award = existingById.get(childRequest.getId());
                award.setAwardName(childRequest.getAwardName().trim());
                award.setDescription(trimToNull(childRequest.getDescription()));
                storyAwardMapper.update(award);
            }
        }
    }

    private void syncGainedItems(
            AdventureEntry entry, List<AdventureGainedItemRequest> requests, UUID userId) {
        UUID entryId = entry.getId();
        Map<UUID, AdventureGainedItem> existingById = gainedItemMapper.findByAdventureEntryId(entryId)
                .stream()
                .collect(Collectors.toMap(AdventureGainedItem::getId, Function.identity()));
        Set<UUID> submittedIds = requests.stream()
                .map(AdventureGainedItemRequest::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        // Legacy forms submit a warehouse ID when no snapshot exists. Validate the
        // relation before any deletion, then let updateGainedItem safely backfill it.
        for (UUID id : submittedIds) {
            if (!existingById.containsKey(id) &&
                    (gainedItemMapper.findById(id) != null ||
                     !isLegacyWarehouseForEntry(inventoryItemMapper.findById(id), entry))) {
                throw new ResourceNotFoundException("獲得物品不屬於此冒險記錄");
            }
        }

        existingById.keySet().stream()
                .filter(id -> !submittedIds.contains(id))
                .forEach(id -> deleteGainedItem(id, userId));

        for (AdventureGainedItemRequest childRequest : requests) {
            if (childRequest.getId() == null) {
                createGainedItemWithWarehouse(entry, childRequest, AcquisitionSource.ADVENTURE, false);
            } else {
                updateGainedItem(entryId, childRequest.getId(), childRequest, userId);
            }
        }
    }

    private UUID createGainedItemWithWarehouse(
            AdventureEntry entry,
            AdventureGainedItemRequest request,
            AcquisitionSource acquisitionSource,
            boolean needsDetails) {
        AdventureGainedItem snapshot = new AdventureGainedItem();
        snapshot.setId(UUID.randomUUID());
        snapshot.setAdventureEntryId(entry.getId());
        snapshot.setItemName(request.getItemName().trim());
        snapshot.setItemType(request.getItemType());
        snapshot.setRarity(request.getRarity());
        snapshot.setItemCategory(request.getItemCategory());
        snapshot.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
        snapshot.setQuantity(request.getQuantity() != null ? request.getQuantity() : 1);
        snapshot.setAcquisitionSource(acquisitionSource);
        snapshot.setNeedsDetails(needsDetails);
        snapshot.setNotes(trimToNull(request.getNotes()));
        gainedItemMapper.insert(snapshot);

        InventoryItem warehouseItem = new InventoryItem();
        warehouseItem.setId(UUID.randomUUID());
        warehouseItem.setCharacterId(entry.getCharacterId());
        warehouseItem.setAdventureEntryId(entry.getId());
        warehouseItem.setAdventureGainedItemId(snapshot.getId());
        warehouseItem.setItemName(snapshot.getItemName());
        warehouseItem.setItemType(parseItemType(snapshot.getItemType()));
        warehouseItem.setRarity(parseRarity(snapshot.getRarity()));
        warehouseItem.setItemCategory(snapshot.getItemCategory());
        warehouseItem.setRequiresAttunement(snapshot.getRequiresAttunement());
        warehouseItem.setQuantity(snapshot.getQuantity());
        warehouseItem.setAcquisitionSource(acquisitionSource);
        warehouseItem.setNeedsDetails(needsDetails);
        warehouseItem.setSource(entry.getAdventureName() != null
                ? entry.getAdventureName()
                : entry.getAdventureCode());
        warehouseItem.setNotes(snapshot.getNotes());
        inventoryItemMapper.insert(warehouseItem);
        return snapshot.getId();
    }

    private void reconcileMagicItemDetails(AdventureEntry entry) {
        refreshCurrentMagicItems(entry.getCharacterId());
    }

    private void validateMagicItemDetails(AdventureEntrySaveRequest request, int expected) {
        if (request.getGainedItems().stream().anyMatch(item ->
                "PERMANENT".equalsIgnoreCase(item.getItemType())
                        && item.getQuantity() != null && item.getQuantity() != 1)) {
            throw new BusinessException("永久性魔法物品必須每件分別填寫明細");
        }
        int actual = request.getGainedItems().stream()
                .filter(item -> "PERMANENT".equalsIgnoreCase(item.getItemType()))
                .mapToInt(item -> 1)
                .sum()
                + request.getGainedItems().stream()
                .filter(item -> "CONSUMABLE".equalsIgnoreCase(item.getItemType()))
                .mapToInt(item -> item.getQuantity() == null ? 1 : item.getQuantity())
                .sum();
        if (actual != expected) {
            throw new BusinessException("魔法物品數量變動為 " + expected + " 件，物品明細數量必須相同（目前 " + actual + " 件）");
        }
    }

    private int positiveMagicItemChanges(AdventureEntryRequest request) {
        return Math.max(0, orZero(request.getMagicItemsChange()))
                + Math.max(0, orZero(request.getMagicItemsDowntimeChange()));
    }

    private void refreshCurrentMagicItems(UUID characterId) {
        int total = inventoryItemMapper.sumQuantityByCharacterIdAndItemType(
                characterId, InventoryItem.ItemType.PERMANENT.name());
        characterMapper.updateCurrentMagicItems(characterId, total);
    }

    private boolean isLegacyWarehouseForEntry(InventoryItem item, AdventureEntry entry) {
        if (item == null || !entry.getCharacterId().equals(item.getCharacterId()) ||
                item.getAdventureGainedItemId() != null) {
            return false;
        }
        if (item.getAdventureEntryId() != null) {
            return entry.getId().equals(item.getAdventureEntryId());
        }
        String source = trimToNull(item.getSource());
        if (source == null || !sourceMatchesEntry(source, entry)) return false;
        // An unlinked legacy source must identify exactly one adventure of this character.
        List<AdventureEntry> matches = entryMapper.findByCharacterIdOrderByPlayDateAsc(entry.getCharacterId())
                .stream().filter(candidate -> sourceMatchesEntry(source, candidate)).toList();
        return matches.size() == 1 && entry.getId().equals(matches.get(0).getId());
    }

    private boolean sourceMatchesEntry(String source, AdventureEntry entry) {
        return source.equalsIgnoreCase(trimToNull(entry.getAdventureName())) ||
                source.equalsIgnoreCase(trimToNull(entry.getAdventureCode()));
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private void mapDescriptiveFields(AdventureEntryRequest request, AdventureEntry entry) {
        entry.setAdventureCode(request.getAdventureCode());
        entry.setAdventureName(request.getAdventureName());
        entry.setPlayDate(request.getPlayDate());
        entry.setDmName(request.getDmName());
        entry.setAdventureNotes(request.getAdventureNotes());
        entry.setSoulCoinChargesUsed(request.getSoulCoinChargesUsed());
    }

    private boolean hasLedgerInput(AdventureEntryRequest request) {
        return request.getLevelChange() != null
                || request.getClassChanges() != null
                || request.getGoldChange() != null
                || request.getGoldDowntimeChange() != null
                || request.getDowntimeChange() != null
                || request.getDowntimeDowntimeChange() != null
                || request.getMagicItemsChange() != null
                || request.getMagicItemsDowntimeChange() != null;
    }

    private void calculateSnapshot(
            AdventureEntry entry,
            AdventureEntryRequest request,
            Character character,
            AdventureEntry previous) {
        String rawStartingClasses = previous != null
                ? previous.getEndingClassesString()
                : firstNonBlank(character.getInitialClassesString(), character.getCurrentClassesString());
        String startingClasses = DndClassNames.serialize(
                DndClassNames.parse(rawStartingClasses), rawStartingClasses);
        int startingLevel = previous != null && previous.getEndingLevel() != null
                ? previous.getEndingLevel()
                : parseTotalLevelFromClassesString(startingClasses);
        int levelChange = orZero(request.getLevelChange());

        Map<String, Integer> endingClasses = parseClasses(startingClasses);
        List<ClassLevelChangeRequest> classChanges = request.getClassChanges() != null
                ? request.getClassChanges() : List.of();
        int classChangeTotal = 0;
        for (ClassLevelChangeRequest change : classChanges) {
            if (change == null || trimToNull(change.getClassName()) == null
                    || change.getLevelChange() == null || change.getLevelChange() <= 0) {
                throw new BusinessException("職業等級變化必須包含有效職業及正整數");
            }
            if (!DndClassNames.isSupported(change.getClassName())) {
                throw new BusinessException("不支援的職業名稱：" + change.getClassName());
            }
            String className = DndClassNames.canonicalize(change.getClassName());
            endingClasses.merge(className, change.getLevelChange(), Integer::sum);
            classChangeTotal += change.getLevelChange();
        }
        if (levelChange < 0 || classChangeTotal != levelChange) {
            throw new BusinessException("各職業等級變化合計必須等於總等級變化");
        }

        entry.setStartingClassesString(startingClasses);
        entry.setEndingClassesString(serializeClasses(endingClasses, startingClasses));
        entry.setStartingLevel(startingLevel);
        entry.setEndingLevel(startingLevel + levelChange);

        entry.setStartingGold(previous != null ? orZero(previous.getGoldTotal()) : orZero(character.getInitialGold()));
        entry.setGoldChange(orZero(request.getGoldChange()));
        entry.setGoldDowntimeChange(orZero(request.getGoldDowntimeChange()));
        entry.setGoldTotal(entry.getStartingGold().add(entry.getGoldChange()).add(entry.getGoldDowntimeChange()));

        entry.setStartingDowntime(previous != null ? orZero(previous.getDowntimeTotal()) : orZero(character.getInitialDowntime()));
        entry.setDowntimeChange(orZero(request.getDowntimeChange()));
        entry.setDowntimeDowntimeChange(orZero(request.getDowntimeDowntimeChange()));
        entry.setDowntimeTotal(entry.getStartingDowntime()
                + entry.getDowntimeChange() + entry.getDowntimeDowntimeChange());

        entry.setStartingMagicItems(previous != null ? orZero(previous.getMagicItemsTotal())
                : inventoryItemMapper.sumUnlinkedPermanentQuantityByCharacterId(character.getId()));
        entry.setMagicItemsChange(orZero(request.getMagicItemsChange()));
        entry.setMagicItemsDowntimeChange(orZero(request.getMagicItemsDowntimeChange()));
        entry.setMagicItemsTotal(entry.getStartingMagicItems()
                + entry.getMagicItemsChange() + entry.getMagicItemsDowntimeChange());
    }

    private void validateSnapshot(AdventureEntry entry) {
        if (entry.getStartingLevel() < 0 || entry.getEndingLevel() > 20) {
            throw new BusinessException("角色總等級必須介於 0 與 20 之間");
        }
        if (entry.getStartingGold().compareTo(BigDecimal.ZERO) < 0
                || entry.getGoldTotal().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("金幣初始值及合計不得為負數");
        }
        if (entry.getStartingDowntime() < 0 || entry.getDowntimeTotal() < 0) {
            throw new BusinessException("休整期天數初始值及合計不得為負數");
        }
        if (entry.getStartingMagicItems() < 0 || entry.getMagicItemsTotal() < 0) {
            throw new BusinessException("魔法物品初始值及合計不得為負數");
        }
    }

    private AdventureContribution contributionOf(AdventureEntry entry) {
        return AdventureContribution.from(entry);
    }

    private void applyFirstEntrySnapshot(Character character, AdventureEntry entry) {
        character.setCurrentClassesString(entry.getEndingClassesString());
        character.setCurrentGold(entry.getGoldTotal());
        character.setCurrentDowntime(entry.getDowntimeTotal());
    }

    private void applyContributionDifference(
            Character character, AdventureContribution oldContribution, AdventureContribution newContribution) {
        Map<String, Integer> currentClasses = parseClasses(
                firstNonBlank(character.getCurrentClassesString(), character.getInitialClassesString()));
        Map<String, Integer> differences = new LinkedHashMap<>();
        oldContribution.classes().forEach((name, level) -> differences.merge(name, -level, Integer::sum));
        newContribution.classes().forEach((name, level) -> differences.merge(name, level, Integer::sum));
        differences.forEach((name, difference) -> {
            int updated = currentClasses.getOrDefault(name, 0) + difference;
            if (updated < 0) {
                throw new BusinessException("職業等級變化會使 " + name + " 低於 0");
            }
            if (updated == 0) {
                currentClasses.remove(name);
            } else {
                currentClasses.put(name, updated);
            }
        });
        int totalLevel = currentClasses.values().stream().mapToInt(Integer::intValue).sum();
        if (totalLevel > 20) {
            throw new BusinessException("角色總等級不得超過 20");
        }
        character.setCurrentClassesString(serializeClasses(currentClasses, character.getInitialClassesString()));
        character.setCurrentGold(orZero(character.getCurrentGold())
                .subtract(oldContribution.gold()).add(newContribution.gold()));
        character.setCurrentDowntime(orZero(character.getCurrentDowntime())
                - oldContribution.downtime() + newContribution.downtime());
    }

    private Map<String, Integer> parseClasses(String classesString) {
        return DndClassNames.parse(classesString);
    }

    private String serializeClasses(Map<String, Integer> classes, String fallback) {
        return DndClassNames.serialize(classes, fallback);
    }

    private String firstNonBlank(String preferred, String fallback) {
        return trimToNull(preferred) != null ? preferred : fallback;
    }

    private BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private int orZero(Integer value) {
        return value != null ? value : 0;
    }

    private AdventureEntryResponse toResponseWithContinuityWarning(AdventureEntry entry) {
        AdventureEntryResponse response = toResponse(entry);
        List<String> warnings = new ArrayList<>();
        int reducedMagicItems = Math.min(0, orZero(entry.getMagicItemsChange()))
                + Math.min(0, orZero(entry.getMagicItemsDowntimeChange()));
        if (reducedMagicItems < 0) {
            warnings.add("本次魔法物品減少 " + Math.abs(reducedMagicItems) + " 件，請至倉庫刪除對應物品");
        }
        if (entry.getPlayDate() == null || entry.getCreatedAt() == null) {
            response.setWarnings(warnings);
            return response;
        }
        AdventureEntry next = entryMapper.findNextForExisting(
                entry.getCharacterId(), entry.getPlayDate(), entry.getCreatedAt(), entry.getId());
        if (next != null && isDiscontinuous(entry, next)) {
            warnings.add("此紀錄與下一筆歷史快照不連續；後續快照未自動改寫");
        }
        response.setWarnings(warnings);
        return response;
    }

    private boolean isDiscontinuous(AdventureEntry current, AdventureEntry next) {
        return !Objects.equals(current.getEndingClassesString(), next.getStartingClassesString())
                || !sameNumber(current.getGoldTotal(), next.getStartingGold())
                || !Objects.equals(current.getDowntimeTotal(), next.getStartingDowntime())
                || !Objects.equals(current.getMagicItemsTotal(), next.getStartingMagicItems());
    }

    private boolean sameNumber(BigDecimal left, BigDecimal right) {
        return left == null ? right == null : right != null && left.compareTo(right) == 0;
    }

    private AdventureEntry findEntry(UUID entryId) {
        AdventureEntry entry = entryMapper.findById(entryId);
        if (entry == null) throw new ResourceNotFoundException("找不到冒險記錄 ID：" + entryId);
        entry.setDowntimeActivities(downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(entryId));
        entry.setStoryAwards(storyAwardMapper.findByAdventureEntryId(entryId));
        return entry;
    }

    private AdventureEntry findEntryAndVerifyOwner(UUID entryId, UUID userId) {
        AdventureEntry entry = findOwnedEntry(entryId, userId);
        entry.setDowntimeActivities(downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(entryId));
        entry.setStoryAwards(storyAwardMapper.findByAdventureEntryId(entryId));
        return entry;
    }

    private AdventureEntry findOwnedEntry(UUID entryId, UUID userId) {
        AdventureEntry entry = entryMapper.findByIdAndUserId(entryId, userId);
        if (entry == null) {
            throw new ResourceNotFoundException("找不到冒險記錄 ID：" + entryId);
        }
        return entry;
    }

    private DowntimeActivity findActivity(UUID activityId) {
        DowntimeActivity activity = downtimeActivityMapper.findById(activityId);
        if (activity == null) throw new ResourceNotFoundException("找不到休整期活動 ID：" + activityId);
        return activity;
    }

    private DowntimeActivity findActivityAndVerifyOwner(UUID activityId, UUID userId) {
        DowntimeActivity activity = findActivity(activityId);
        findOwnedEntry(activity.getAdventureEntryId(), userId);
        return activity;
    }

    private AdventureGainedItem findGainedItemAndVerifyOwner(UUID itemId, UUID userId) {
        AdventureGainedItem item = gainedItemMapper.findById(itemId);
        if (item == null) {
            throw new ResourceNotFoundException("找不到獲得物品快照 ID: " + itemId);
        }
        findOwnedEntry(item.getAdventureEntryId(), userId);
        return item;
    }

    // ── 故事獎勵 (Story Awards) ───────────────────────────────────────────────

    public List<StoryAwardResponse> getStoryAwards(UUID entryId, UUID userId) {
        findOwnedEntry(entryId, userId);
        return storyAwardMapper.findByAdventureEntryId(entryId)
                .stream().map(this::toStoryAwardResponse).toList();
    }

    @Transactional
    public StoryAwardResponse createStoryAward(UUID entryId, StoryAwardRequest request, UUID userId) {
        findOwnedEntry(entryId, userId);
        if (request.getAwardName() == null || request.getAwardName().trim().isEmpty()) {
            throw new BusinessException("故事獎勵名稱不可為空");
        }
        StoryAward award = new StoryAward();
        award.setId(UUID.randomUUID());
        award.setAdventureEntryId(entryId);
        award.setAwardName(request.getAwardName().trim());
        award.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        storyAwardMapper.insert(award);
        return toStoryAwardResponse(findStoryAward(award.getId()));
    }

    @Transactional
    public StoryAwardResponse updateStoryAward(UUID entryId, UUID awardId, StoryAwardRequest request, UUID userId) {
        StoryAward award = findStoryAwardAndVerifyOwner(awardId, userId);
        if (!entryId.equals(award.getAdventureEntryId())) {
            throw new ResourceNotFoundException("找不到此冒險記錄的故事獎勵 ID：" + awardId);
        }
        if (request.getAwardName() == null || request.getAwardName().trim().isEmpty()) {
            throw new BusinessException("故事獎勵名稱不可為空");
        }
        award.setAwardName(request.getAwardName().trim());
        award.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        storyAwardMapper.update(award);
        return toStoryAwardResponse(findStoryAward(awardId));
    }

    @Transactional
    public void deleteStoryAward(UUID awardId, UUID userId) {
        findStoryAwardAndVerifyOwner(awardId, userId);
        storyAwardMapper.deleteById(awardId);
    }

    private StoryAward findStoryAward(UUID awardId) {
        StoryAward award = storyAwardMapper.findById(awardId);
        if (award == null) throw new ResourceNotFoundException("找不到故事獎勵 ID：" + awardId);
        return award;
    }

    private StoryAward findStoryAwardAndVerifyOwner(UUID awardId, UUID userId) {
        StoryAward award = findStoryAward(awardId);
        findOwnedEntry(award.getAdventureEntryId(), userId);
        return award;
    }

    private StoryAwardResponse toStoryAwardResponse(StoryAward award) {
        StoryAwardResponse response = new StoryAwardResponse();
        response.setId(award.getId());
        response.setAdventureEntryId(award.getAdventureEntryId());
        response.setAwardName(award.getAwardName());
        response.setDescription(award.getDescription());
        response.setCreatedAt(award.getCreatedAt());
        response.setUpdatedAt(award.getUpdatedAt());
        return response;
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
        response.setRecordingModelVersion(entry.getRecordingModelVersion());
        response.setCreatedAt(entry.getCreatedAt());
        response.setUpdatedAt(entry.getUpdatedAt());
        response.setDowntimeActivities(entry.getDowntimeActivities() != null
                ? entry.getDowntimeActivities().stream().map(this::toActivityResponse).toList()
                : List.of());
        response.setStoryAwards(entry.getStoryAwards() != null
                ? entry.getStoryAwards().stream().map(this::toStoryAwardResponse).toList()
                : List.of());
        response.setWarnings(List.of());
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
        response.setItemCategory(item.getItemCategory());
        response.setRequiresAttunement(item.getRequiresAttunement());
        response.setQuantity(item.getQuantity());
        response.setAcquisitionSource(item.getAcquisitionSource());
        response.setNeedsDetails(item.getNeedsDetails());
        response.setNotes(item.getNotes());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }
}
