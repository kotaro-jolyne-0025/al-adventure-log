package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.InventoryItemRequest;
import com.dndadvlog.backend.dto.InventoryItemResponse;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryItemServiceTest {
    @Mock InventoryItemMapper inventoryItemMapper;
    @Mock CharacterService characterService;
    @Mock AdventureEntryMapper entryMapper;
    @Mock AdventureGainedItemMapper gainedItemMapper;
    @Mock CharacterMapper characterMapper;
    @InjectMocks InventoryItemService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID characterId = UUID.randomUUID();
    private final UUID entryId = UUID.randomUUID();
    private final UUID snapshotId = UUID.randomUUID();

    @Test
    void rejectsAdventureNotOwnedByUserBeforeWriting() {
        InventoryItemRequest request = request();
        request.setAdventureEntryId(entryId);
        assertThrows(ResourceNotFoundException.class, () -> service.createItem(characterId, request, userId));
        verify(inventoryItemMapper, never()).insert(any());
    }

    @Test
    void rejectsAdventureOfAnotherCharacterEvenIfSameUserOwnsBoth() {
        AdventureEntry entry = ownedEntry();
        entry.setCharacterId(UUID.randomUUID());
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(entry);
        InventoryItemRequest request = request();
        request.setAdventureEntryId(entryId);
        assertThrows(ResourceNotFoundException.class, () -> service.createItem(characterId, request, userId));
        verify(inventoryItemMapper, never()).insert(any());
    }

    @Test
    void rejectsSnapshotFromDifferentAdventure() {
        AdventureGainedItem snapshot = snapshot();
        snapshot.setAdventureEntryId(UUID.randomUUID());
        when(gainedItemMapper.findById(snapshotId)).thenReturn(snapshot);
        InventoryItemRequest request = request();
        request.setAdventureEntryId(entryId);
        request.setAdventureGainedItemId(snapshotId);
        assertThrows(ResourceNotFoundException.class, () -> service.createItem(characterId, request, userId));
        verify(inventoryItemMapper, never()).insert(any());
    }

    @Test
    void validatesSnapshotOwnerWhenAdventureIdIsOmitted() {
        when(gainedItemMapper.findById(snapshotId)).thenReturn(snapshot());
        InventoryItemRequest request = request();
        request.setAdventureGainedItemId(snapshotId);
        assertThrows(ResourceNotFoundException.class, () -> service.createItem(characterId, request, userId));
        verify(entryMapper).findByIdAndUserId(entryId, userId);
        verify(inventoryItemMapper, never()).insert(any());
    }

    @Test
    void preservesProvenanceDuringOrdinaryInventoryEdit() {
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        item.setAdventureEntryId(entryId);
        item.setAdventureGainedItemId(snapshotId);
        when(inventoryItemMapper.findById(item.getId())).thenReturn(item);
        when(gainedItemMapper.findById(snapshotId)).thenReturn(snapshot());
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(ownedEntry());
        service.updateItem(characterId, item.getId(), request(), userId);
        assertEquals(entryId, item.getAdventureEntryId());
        assertEquals(snapshotId, item.getAdventureGainedItemId());
        verify(inventoryItemMapper).update(item);
    }

    @Test
    void permitsManualItemWithoutAdventureLinks() {
        when(inventoryItemMapper.findById(any())).thenReturn(new InventoryItem());
        service.createItem(characterId, request(), userId);
        verify(inventoryItemMapper).insert(any());
        verifyNoInteractions(entryMapper, gainedItemMapper);
    }

    @Test
    void refreshesCharacterFromPermanentQuantitySumAfterEveryMutation() {
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        item.setItemType(InventoryItem.ItemType.CONSUMABLE);
        when(inventoryItemMapper.findById(item.getId())).thenReturn(item);
        when(inventoryItemMapper.sumQuantityByCharacterIdAndItemType(
                characterId, InventoryItem.ItemType.PERMANENT.name())).thenReturn(5);

        InventoryItemRequest update = request();
        update.setItemType(InventoryItem.ItemType.CONSUMABLE);
        update.setQuantity(99);
        service.updateItem(characterId, item.getId(), update, userId);
        service.deleteItem(characterId, item.getId(), userId);

        verify(characterMapper, times(2)).updateCurrentMagicItems(characterId, 5);
        verify(inventoryItemMapper, times(2)).sumQuantityByCharacterIdAndItemType(
                characterId, InventoryItem.ItemType.PERMANENT.name());
    }

    @Test
    void responsePreservesAdventureDowntimeAndUnknownSources() {
        InventoryItem adventure = inventoryItem(AcquisitionSource.ADVENTURE, false);
        InventoryItem downtime = inventoryItem(AcquisitionSource.DOWNTIME, true);
        InventoryItem unknown = inventoryItem(null, false);
        when(inventoryItemMapper.findByCharacterId(characterId))
                .thenReturn(List.of(adventure, downtime, unknown));

        List<InventoryItemResponse> responses = service.getItems(characterId, null, userId);

        assertEquals(AcquisitionSource.ADVENTURE, responses.get(0).getAcquisitionSource());
        assertEquals(AcquisitionSource.DOWNTIME, responses.get(1).getAcquisitionSource());
        assertTrue(responses.get(1).getNeedsDetails());
        assertNull(responses.get(2).getAcquisitionSource());
    }

    private AdventureEntry ownedEntry() {
        AdventureEntry entry = new AdventureEntry();
        entry.setId(entryId); entry.setCharacterId(characterId);
        return entry;
    }

    private AdventureGainedItem snapshot() {
        AdventureGainedItem snapshot = new AdventureGainedItem();
        snapshot.setId(snapshotId); snapshot.setAdventureEntryId(entryId);
        return snapshot;
    }

    private InventoryItemRequest request() {
        InventoryItemRequest request = new InventoryItemRequest();
        request.setItemName("Sword"); request.setItemType(InventoryItem.ItemType.PERMANENT);
        return request;
    }

    private InventoryItem inventoryItem(AcquisitionSource source, boolean needsDetails) {
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        item.setAcquisitionSource(source);
        item.setNeedsDetails(needsDetails);
        return item;
    }
}
