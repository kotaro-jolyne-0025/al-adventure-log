package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.InventoryItemRequest;
import com.dndadvlog.backend.dto.InventoryItemResponse;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryItemService {

    private final InventoryItemMapper inventoryItemMapper;
    private final CharacterService characterService;

    public List<InventoryItemResponse> getItems(UUID characterId, InventoryItem.ItemType itemType, UUID userId) {
        characterService.findCharacter(characterId, userId);
        List<InventoryItem> items = (itemType != null)
                ? inventoryItemMapper.findByCharacterIdAndItemType(characterId, itemType.name())
                : inventoryItemMapper.findByCharacterId(characterId);
        return items.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public InventoryItemResponse createItem(UUID characterId, InventoryItemRequest request, UUID userId) {
        characterService.findCharacter(characterId, userId);
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        mapRequestToItem(request, item);
        inventoryItemMapper.insert(item);
        return toResponse(findItem(item.getId()));
    }

    @Transactional
    public InventoryItemResponse updateItem(UUID characterId, UUID itemId, InventoryItemRequest request, UUID userId) {
        characterService.findCharacter(characterId, userId);
        InventoryItem item = findItem(itemId);
        if (!characterId.equals(item.getCharacterId())) {
            throw new ResourceNotFoundException("找不到物品 ID：" + itemId);
        }
        mapRequestToItem(request, item);
        inventoryItemMapper.update(item);
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
    }

    private InventoryItem findItem(UUID itemId) {
        InventoryItem item = inventoryItemMapper.findById(itemId);
        if (item == null) {
            throw new ResourceNotFoundException("找不到物品 ID：" + itemId);
        }
        return item;
    }

    private void mapRequestToItem(InventoryItemRequest request, InventoryItem item) {
        item.setAdventureEntryId(request.getAdventureEntryId());
        item.setAdventureGainedItemId(request.getAdventureGainedItemId());
        item.setItemName(request.getItemName());
        item.setItemType(request.getItemType());
        item.setRarity(request.getRarity());
        item.setRequiresAttunement(Boolean.TRUE.equals(request.getRequiresAttunement()));
        item.setQuantity(request.getQuantity() != null ? request.getQuantity() : 1);
        item.setSource(request.getSource());
        item.setNotes(request.getNotes());
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
        response.setSource(item.getSource());
        response.setNotes(item.getNotes());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }
}