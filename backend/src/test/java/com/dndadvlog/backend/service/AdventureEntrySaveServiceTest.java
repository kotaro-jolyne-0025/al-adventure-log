package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureEntryRequest;
import com.dndadvlog.backend.dto.AdventureEntrySaveRequest;
import com.dndadvlog.backend.dto.AdventureGainedItemRequest;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdventureEntrySaveServiceTest {
    @Mock AdventureEntryMapper entryMapper;
    @Mock CharacterMapper characterMapper;
    @Mock DowntimeActivityMapper downtimeActivityMapper;
    @Mock AdventureGainedItemMapper gainedItemMapper;
    @Mock StoryAwardMapper storyAwardMapper;
    @Mock CharacterService characterService;
    @Mock InventoryItemMapper inventoryItemMapper;
    @InjectMocks AdventureEntryService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID characterId = UUID.randomUUID();
    private final UUID entryId = UUID.randomUUID();
    private final UUID legacyId = UUID.randomUUID();

    @Test
    void aggregateSaveBackfillsOwnedLegacyWarehouseWithoutDuplicatingIt() {
        AdventureEntry entry = ownedEntry();
        InventoryItem warehouse = legacyItem();
        List<AdventureGainedItem> snapshots = new ArrayList<>();
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(entry);
        when(entryMapper.findById(entryId)).thenReturn(entry);
        when(gainedItemMapper.findByAdventureEntryId(entryId)).thenAnswer(inv -> snapshots);
        when(gainedItemMapper.findById(legacyId)).thenAnswer(inv -> snapshots.isEmpty() ? null : snapshots.get(0));
        when(inventoryItemMapper.findById(legacyId)).thenReturn(warehouse);
        when(inventoryItemMapper.findByAdventureGainedItemId(legacyId)).thenReturn(warehouse);
        doAnswer(inv -> { snapshots.add(inv.getArgument(0)); return null; }).when(gainedItemMapper).insert(any());

        service.updateEntryWithDetails(entryId, saveRequest(), userId);

        assertEquals(1, snapshots.size());
        assertEquals(legacyId, warehouse.getAdventureGainedItemId());
        assertEquals(entryId, warehouse.getAdventureEntryId());
        verify(inventoryItemMapper, never()).insert(any());
        verify(gainedItemMapper, never()).deleteById(any());
    }

    @Test
    void rejectsLegacyWarehouseBelongingToAnotherCharacter() {
        InventoryItem warehouse = legacyItem();
        warehouse.setCharacterId(UUID.randomUUID());
        assertLegacyRejected(warehouse);
    }

    @Test
    void rejectsLegacyWarehouseAlreadyLinkedToAnotherAdventure() {
        InventoryItem warehouse = legacyItem();
        warehouse.setAdventureEntryId(UUID.randomUUID());
        assertLegacyRejected(warehouse);
    }

    @Test
    void rejectsLegacyWarehouseAlreadyBoundToAnotherSnapshot() {
        InventoryItem warehouse = legacyItem();
        warehouse.setAdventureGainedItemId(UUID.randomUUID());
        assertLegacyRejected(warehouse);
    }

    @Test
    void rejectsForeignSnapshotIdBeforeUpdatingParent() {
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(ownedEntry());
        AdventureGainedItem foreign = new AdventureGainedItem();
        foreign.setAdventureEntryId(UUID.randomUUID());
        when(gainedItemMapper.findById(legacyId)).thenReturn(foreign);
        assertThrows(ResourceNotFoundException.class,
                () -> service.updateEntryWithDetails(entryId, saveRequest(), userId));
        verify(entryMapper, never()).update(any());
        verifyNoInteractions(inventoryItemMapper);
    }

    @Test
    void rejectsAmbiguousLegacySource() {
        InventoryItem warehouse = legacyItem();
        warehouse.setAdventureEntryId(null);
        warehouse.setSource("Old adventure");
        AdventureEntry other = ownedEntry();
        other.setId(UUID.randomUUID());
        when(entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(ownedEntry(), other));
        assertLegacyRejected(warehouse);
    }

    @Test
    void backfillsUniqueUnlinkedSourceBeforeRenamingAdventure() {
        AdventureEntry entry = ownedEntry();
        InventoryItem warehouse = legacyItem();
        warehouse.setAdventureEntryId(null);
        warehouse.setSource("Old adventure");
        List<AdventureGainedItem> snapshots = new ArrayList<>();
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(entry);
        when(entryMapper.findById(entryId)).thenReturn(entry);
        when(entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(entry));
        when(gainedItemMapper.findByAdventureEntryId(entryId)).thenAnswer(inv -> snapshots);
        when(gainedItemMapper.findById(legacyId)).thenAnswer(inv -> snapshots.isEmpty() ? null : snapshots.get(0));
        when(inventoryItemMapper.findById(legacyId)).thenReturn(warehouse);
        when(inventoryItemMapper.findByAdventureGainedItemId(legacyId)).thenReturn(warehouse);
        doAnswer(inv -> { snapshots.add(inv.getArgument(0)); return null; }).when(gainedItemMapper).insert(any());
        service.updateEntryWithDetails(entryId, saveRequest(), userId);
        assertEquals("Renamed adventure", entry.getAdventureName());
        assertEquals(entryId, warehouse.getAdventureEntryId());
        assertEquals(legacyId, warehouse.getAdventureGainedItemId());
    }

    private void assertLegacyRejected(InventoryItem warehouse) {
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(ownedEntry());
        when(inventoryItemMapper.findById(legacyId)).thenReturn(warehouse);
        assertThrows(ResourceNotFoundException.class,
                () -> service.updateEntryWithDetails(entryId, saveRequest(), userId));
        verify(entryMapper, never()).update(any());
        verify(inventoryItemMapper, never()).update(any());
        verify(gainedItemMapper, never()).insert(any());
    }

    private AdventureEntry ownedEntry() {
        AdventureEntry entry = new AdventureEntry();
        entry.setId(entryId); entry.setCharacterId(characterId); entry.setAdventureName("Old adventure");
        return entry;
    }

    private InventoryItem legacyItem() {
        InventoryItem item = new InventoryItem();
        item.setId(legacyId); item.setCharacterId(characterId); item.setAdventureEntryId(entryId);
        item.setQuantity(1);
        return item;
    }

    private AdventureEntrySaveRequest saveRequest() {
        AdventureGainedItemRequest item = new AdventureGainedItemRequest();
        item.setId(legacyId); item.setItemName("Sword"); item.setItemType("PERMANENT");
        AdventureEntryRequest entry = new AdventureEntryRequest();
        entry.setAdventureName("Renamed adventure");
        AdventureEntrySaveRequest request = new AdventureEntrySaveRequest();
        request.setEntry(entry); request.setGainedItems(List.of(item));
        request.setDowntimeActivities(List.of()); request.setStoryAwards(List.of());
        return request;
    }
}
