package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureEntryRequest;
import com.dndadvlog.backend.dto.AdventureEntryResponse;
import com.dndadvlog.backend.dto.AdventureEntrySaveRequest;
import com.dndadvlog.backend.dto.AdventureGainedItemRequest;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MagicItemReconciliationServiceTest {

    @Mock AdventureEntryMapper entryMapper;
    @Mock CharacterMapper characterMapper;
    @Mock DowntimeActivityMapper downtimeActivityMapper;
    @Mock AdventureGainedItemMapper gainedItemMapper;
    @Mock StoryAwardMapper storyAwardMapper;
    @Mock CharacterService characterService;
    @Mock InventoryItemMapper inventoryItemMapper;
    @InjectMocks AdventureEntryService service;

    @Test
    void createsSourceSpecificPlaceholdersAndRaisesChangeForExtraNamedItems() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character character = new Character();
        character.setId(characterId);
        character.setInitialClassesString("戰士 (Fighter)1");
        character.setCurrentClassesString("戰士 (Fighter)1");
        character.setCurrentGold(java.math.BigDecimal.ZERO);
        character.setCurrentDowntime(0);
        List<AdventureEntry> entries = new ArrayList<>();
        List<AdventureGainedItem> snapshots = new ArrayList<>();
        List<InventoryItem> inventory = new ArrayList<>();

        when(characterService.findCharacter(characterId, userId)).thenReturn(character);
        doAnswer(invocation -> {
            entries.add(invocation.getArgument(0));
            return null;
        }).when(entryMapper).insert(any());
        when(entryMapper.findById(any())).thenAnswer(invocation -> entries.stream()
                .filter(entry -> entry.getId().equals(invocation.getArgument(0)))
                .findFirst().orElse(null));
        when(entryMapper.findByIdAndUserId(any(), any())).thenAnswer(invocation -> entries.stream()
                .filter(entry -> entry.getId().equals(invocation.getArgument(0)))
                .findFirst().orElse(null));
        when(gainedItemMapper.findByAdventureEntryId(any())).thenAnswer(invocation -> snapshots.stream()
                .filter(item -> item.getAdventureEntryId().equals(invocation.getArgument(0)))
                .toList());
        when(gainedItemMapper.findById(any())).thenAnswer(invocation -> snapshots.stream()
                .filter(item -> item.getId().equals(invocation.getArgument(0)))
                .findFirst().orElse(null));
        doAnswer(invocation -> {
            snapshots.add(invocation.getArgument(0));
            return null;
        }).when(gainedItemMapper).insert(any());
        doAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            snapshots.removeIf(item -> item.getId().equals(id));
            return null;
        }).when(gainedItemMapper).deleteById(any());
        doAnswer(invocation -> {
            inventory.add(invocation.getArgument(0));
            return null;
        }).when(inventoryItemMapper).insert(any());
        when(inventoryItemMapper.findByAdventureGainedItemId(any())).thenAnswer(invocation -> inventory.stream()
                .filter(item -> invocation.getArgument(0).equals(item.getAdventureGainedItemId()))
                .findFirst().orElse(null));
        doAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            inventory.removeIf(item -> item.getId().equals(id));
            return null;
        }).when(inventoryItemMapper).deleteById(any());
        when(inventoryItemMapper.sumQuantityByCharacterIdAndItemType(
                characterId, InventoryItem.ItemType.PERMANENT.name())).thenAnswer(invocation -> inventory.stream()
                .filter(item -> item.getItemType() == InventoryItem.ItemType.PERMANENT)
                .mapToInt(InventoryItem::getQuantity)
                .sum());
        when(downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        when(storyAwardMapper.findByAdventureEntryId(any())).thenReturn(List.of());

        AdventureEntryRequest entry = new AdventureEntryRequest();
        entry.setPlayDate(LocalDate.of(2026, 9, 19));
        entry.setLevelChange(0);
        entry.setClassChanges(List.of());
        entry.setMagicItemsChange(3);
        entry.setMagicItemsDowntimeChange(2);
        AdventureEntrySaveRequest save = new AdventureEntrySaveRequest();
        save.setEntry(entry);
        save.setDowntimeActivities(List.of());
        save.setStoryAwards(List.of());
        save.setGainedItems(List.of(permanent("長劍")));

        AdventureEntryResponse firstResponse = service.createEntryWithDetails(characterId, save, userId);

        assertEquals(3, firstResponse.getMagicItemsChange());
        AdventureGainedItem adventurePlaceholder = snapshots.stream()
                .filter(item -> item.getAcquisitionSource() == AcquisitionSource.ADVENTURE)
                .filter(item -> Boolean.TRUE.equals(item.getNeedsDetails()))
                .findFirst().orElseThrow();
        assertEquals(2, adventurePlaceholder.getQuantity());

        AdventureGainedItem namedAdventureItem = snapshots.stream()
                .filter(item -> item.getAcquisitionSource() == AcquisitionSource.ADVENTURE)
                .filter(item -> !Boolean.TRUE.equals(item.getNeedsDetails()))
                .findFirst().orElseThrow();
        AdventureGainedItemRequest existingNamed = permanent("長劍");
        existingNamed.setId(namedAdventureItem.getId());
        AdventureEntryRequest correctedEntry = new AdventureEntryRequest();
        correctedEntry.setPlayDate(entry.getPlayDate());
        correctedEntry.setLevelChange(0);
        correctedEntry.setClassChanges(List.of());
        correctedEntry.setMagicItemsChange(1);
        correctedEntry.setMagicItemsDowntimeChange(2);
        AdventureEntrySaveRequest corrected = new AdventureEntrySaveRequest();
        corrected.setEntry(correctedEntry);
        corrected.setDowntimeActivities(List.of());
        corrected.setStoryAwards(List.of());
        corrected.setGainedItems(List.of(existingNamed, permanent("盾牌")));

        AdventureEntryResponse response = service.updateEntryWithDetails(
                firstResponse.getId(), corrected, userId);

        assertEquals(2, response.getMagicItemsChange());
        assertEquals(2, response.getMagicItemsDowntimeChange());
        assertEquals(4, response.getMagicItemsTotal());
        assertEquals(2, snapshots.stream()
                .filter(item -> item.getAcquisitionSource() == AcquisitionSource.ADVENTURE)
                .filter(item -> !Boolean.TRUE.equals(item.getNeedsDetails()))
                .count());
        AdventureGainedItem downtimePlaceholder = snapshots.stream()
                .filter(item -> item.getAcquisitionSource() == AcquisitionSource.DOWNTIME)
                .findFirst().orElseThrow();
        assertTrue(downtimePlaceholder.getNeedsDetails());
        assertEquals(2, downtimePlaceholder.getQuantity());
        assertFalse(snapshots.stream().anyMatch(item ->
                item.getAcquisitionSource() == AcquisitionSource.ADVENTURE
                        && Boolean.TRUE.equals(item.getNeedsDetails())));
        verify(characterMapper, atLeastOnce()).updateCurrentMagicItems(characterId, 4);
    }

    private AdventureGainedItemRequest permanent(String name) {
        AdventureGainedItemRequest request = new AdventureGainedItemRequest();
        request.setItemName(name);
        request.setItemType("PERMANENT");
        return request;
    }
}
