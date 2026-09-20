package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.InventoryItemRequest;
import com.dndadvlog.backend.dto.InventoryItemResponse;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryItemService {

    private final InventoryItemMapper inventoryItemMapper;
    private final CharacterService characterService;
    private final AdventureEntryMapper entryMapper;
    private final AdventureGainedItemMapper gainedItemMapper;
    private final CharacterMapper characterMapper;

    public List<InventoryItemResponse> getItems(UUID characterId, InventoryItem.ItemType itemType, UUID userId) {
        characterService.findCharacter(characterId, userId);
        List<InventoryItem> items = (itemType != null)
                ? inventoryItemMapper.findByCharacterIdAndItemType(characterId, itemType.name())
                : inventoryItemMapper.findByCharacterId(characterId);
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional
    public InventoryItemResponse createItem(UUID characterId, InventoryItemRequest request, UUID userId) {
        characterService.findCharacter(characterId, userId);
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        validateAndSetRelations(request, item, userId);
        mapRequestToItem(request, item);
        inventoryItemMapper.insert(item);
        refreshCurrentMagicItems(characterId);
        return toResponse(findItem(item.getId()));
    }

    @Transactional
    public InventoryItemResponse updateItem(UUID characterId, UUID itemId, InventoryItemRequest request, UUID userId) {
        characterService.findCharacter(characterId, userId);
        InventoryItem item = findItem(itemId);
        if (!characterId.equals(item.getCharacterId())) {
            throw new ResourceNotFoundException("找不到物品 ID：" + itemId);
        }
        validateAndSetRelations(request, item, userId);
        mapRequestToItem(request, item);
        if (Boolean.TRUE.equals(item.getNeedsDetails())
                && !"未命名魔法物品".equals(request.getItemName().trim())) {
            item.setNeedsDetails(false);
        }
        inventoryItemMapper.update(item);
        refreshCurrentMagicItems(characterId);
        return toResponse(findItem(itemId));
    }

    @Transactional
    public void deleteItem(UUID characterId, UUID itemId, UUID userId) {
        characterService.findCharacter(characterId, userId);
        InventoryItem item = findItem(itemId);
        if (!characterId.equals(item.getCharacterId())) {
            throw new ResourceNotFoundException("找不到物品 ID：" + itemId);
        }
        inventoryItemMapper.deleteById(itemId);
        refreshCurrentMagicItems(characterId);
    }

    private InventoryItem findItem(UUID itemId) {
        InventoryItem item = inventoryItemMapper.findById(itemId);
        if (item == null) {
            throw new ResourceNotFoundException("找不到物品 ID：" + itemId);
        }
        return item;
    }

    private void mapRequestToItem(InventoryItemRequest request, InventoryItem item) {
        item.setItemName(request.getItemName());
        item.setItemType(request.getItemType());
        item.setRarity(request.getRarity());
        item.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
        item.setQuantity(request.getQuantity() != null ? request.getQuantity() : Integer.valueOf(1));
        item.setSource(request.getSource());
        item.setNotes(request.getNotes());
    }

    private void refreshCurrentMagicItems(UUID characterId) {
        int total = inventoryItemMapper.sumQuantityByCharacterIdAndItemType(
                characterId, InventoryItem.ItemType.PERMANENT.name());
        characterMapper.updateCurrentMagicItems(characterId, total);
    }

    private void validateAndSetRelations(InventoryItemRequest request, InventoryItem item, UUID userId) {
        // Ordinary inventory edits omit these fields; preserve the existing provenance.
        UUID entryId = request.getAdventureEntryId() != null
                ? request.getAdventureEntryId() : item.getAdventureEntryId();
        UUID snapshotId = request.getAdventureGainedItemId() != null
                ? request.getAdventureGainedItemId() : item.getAdventureGainedItemId();
        if (snapshotId != null) {
            AdventureGainedItem snapshot = gainedItemMapper.findById(snapshotId);
            if (snapshot == null || (entryId != null && !entryId.equals(snapshot.getAdventureEntryId()))) {
                throw new ResourceNotFoundException("物品快照不屬於此冒險記錄");
            }
            entryId = snapshot.getAdventureEntryId();
        }
        if (entryId != null) {
            AdventureEntry entry = entryMapper.findByIdAndUserId(entryId, userId);
            if (entry == null || !item.getCharacterId().equals(entry.getCharacterId())) {
                throw new ResourceNotFoundException("冒險記錄不屬於此角色");
            }
        }
        item.setAdventureEntryId(entryId);
        item.setAdventureGainedItemId(snapshotId);
    }

    private InventoryItemResponse toResponse(InventoryItem item) {
        InventoryItemResponse response = new InventoryItemResponse();
        response.setId(item.getId());
        response.setCharacterId(item.getCharacterId());
        response.setAdventureEntryId(item.getAdventureEntryId());
        response.setAdventureGainedItemId(item.getAdventureGainedItemId());
        response.setItemName(item.getItemName());
        response.setItemType(item.getItemType());
        response.setRarity(item.getRarity());
        response.setRequiresAttunement(item.getRequiresAttunement());
        response.setQuantity(item.getQuantity());
        response.setAcquisitionSource(item.getAcquisitionSource());
        response.setNeedsDetails(item.getNeedsDetails());
        response.setSource(item.getSource());
        response.setNotes(item.getNotes());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }
}
