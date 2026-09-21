package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureGainedItemRequest;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdventureLootCorrectionServiceTest {

    @Mock AdventureEntryMapper entryMapper;
    @Mock CharacterMapper characterMapper;
    @Mock DowntimeActivityMapper downtimeActivityMapper;
    @Mock AdventureGainedItemMapper gainedItemMapper;
    @Mock StoryAwardMapper storyAwardMapper;
    @Mock CharacterService characterService;
    @Mock InventoryItemMapper inventoryItemMapper;
    @InjectMocks AdventureEntryService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID entryId = UUID.randomUUID();
    private final UUID characterId = UUID.randomUUID();
    private AdventureEntry entry;
    private AdventureGainedItem snapshot;

    @BeforeEach
    void setUp() {
        entry = new AdventureEntry();
        entry.setId(entryId);
        entry.setCharacterId(characterId);
        snapshot = new AdventureGainedItem();
        snapshot.setId(UUID.randomUUID());
        snapshot.setAdventureEntryId(entryId);
        snapshot.setItemName("治療藥水");
        snapshot.setItemType("CONSUMABLE");
        snapshot.setQuantity(3);
        snapshot.setAcquisitionSource(AcquisitionSource.ADVENTURE);
        snapshot.setNeedsDetails(false);
        when(entryMapper.findByIdAndUserId(entryId, userId)).thenReturn(entry);
        when(gainedItemMapper.findById(snapshot.getId())).thenReturn(snapshot);
    }

    @Test
    void unchangedQuantityDoesNotRestockDeletedInventory() {
        service.updateGainedItem(entryId, snapshot.getId(), request(3), userId);

        verify(inventoryItemMapper, never()).insert(any());
    }

    @Test
    void increasingDeletedLootCreatesOnlyThePositiveDifference() {
        service.updateGainedItem(entryId, snapshot.getId(), request(5), userId);

        ArgumentCaptor<InventoryItem> inserted = ArgumentCaptor.forClass(InventoryItem.class);
        verify(inventoryItemMapper).insert(inserted.capture());
        assertEquals(2, inserted.getValue().getQuantity());
        assertEquals(AcquisitionSource.ADVENTURE, inserted.getValue().getAcquisitionSource());
    }

    @Test
    void decreasingLootFloorsRemainingInventoryAtZero() {
        snapshot.setQuantity(5);
        InventoryItem warehouse = new InventoryItem();
        warehouse.setId(UUID.randomUUID());
        warehouse.setQuantity(2);
        when(inventoryItemMapper.findByAdventureGainedItemId(snapshot.getId())).thenReturn(warehouse);

        service.updateGainedItem(entryId, snapshot.getId(), request(1), userId);

        verify(inventoryItemMapper).deleteById(warehouse.getId());
        verify(inventoryItemMapper, never()).insert(any());
        assertEquals(1, snapshot.getQuantity());
    }

    private AdventureGainedItemRequest request(int quantity) {
        AdventureGainedItemRequest request = new AdventureGainedItemRequest();
        request.setItemName("治療藥水");
        request.setItemType("CONSUMABLE");
        request.setQuantity(quantity);
        return request;
    }
}
