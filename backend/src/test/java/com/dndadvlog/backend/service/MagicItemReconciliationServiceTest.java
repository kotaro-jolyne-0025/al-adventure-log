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
    void savesExactDetailsIncludingConsumableQuantitiesWithoutPlaceholders() {
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
        doAnswer(invocation -> {
            snapshots.add(invocation.getArgument(0));
            return null;
        }).when(gainedItemMapper).insert(any());
        doAnswer(invocation -> {
            inventory.add(invocation.getArgument(0));
            return null;
        }).when(inventoryItemMapper).insert(any());
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
        AdventureGainedItemRequest potion = permanent("Potion");
        potion.setItemType("CONSUMABLE");
        potion.setQuantity(4);
        potion.setItemCategory(InventoryItem.ItemCategory.POTION);
        save.setGainedItems(List.of(permanent("Sword"), potion));

        AdventureEntryResponse firstResponse = service.createEntryWithDetails(characterId, save, userId);

        assertEquals(3, firstResponse.getMagicItemsChange());
        assertEquals(2, firstResponse.getMagicItemsDowntimeChange());
        assertEquals(2, snapshots.size());
        assertFalse(snapshots.stream().anyMatch(item -> Boolean.TRUE.equals(item.getNeedsDetails())));
        assertEquals(InventoryItem.ItemCategory.POTION, snapshots.get(1).getItemCategory());
        assertEquals(InventoryItem.ItemCategory.POTION, inventory.get(1).getItemCategory());
        verify(characterMapper, atLeastOnce()).updateCurrentMagicItems(characterId, 1);
    }

    @Test
    void rejectsMissingExtraAndBatchedPermanentDetailsBeforeWriting() {
        AdventureEntrySaveRequest save = new AdventureEntrySaveRequest();
        AdventureEntryRequest entry = new AdventureEntryRequest();
        entry.setMagicItemsChange(2);
        save.setEntry(entry);
        for (List<AdventureGainedItemRequest> details : List.of(
                List.<AdventureGainedItemRequest>of(), List.of(permanent("Sword")),
                List.of(permanent("Sword"), permanent("Shield"), permanent("Wand")))) {
            save.setGainedItems(details);
            org.junit.jupiter.api.Assertions.assertThrows(
                    com.dndadvlog.backend.exception.BusinessException.class,
                    () -> service.createEntryWithDetails(UUID.randomUUID(), save, UUID.randomUUID()));
        }
        entry.setMagicItemsChange(1);
        AdventureGainedItemRequest batched = permanent("Sword");
        batched.setQuantity(2);
        save.setGainedItems(List.of(batched));
        org.junit.jupiter.api.Assertions.assertThrows(
                com.dndadvlog.backend.exception.BusinessException.class,
                () -> service.createEntryWithDetails(UUID.randomUUID(), save, UUID.randomUUID()));
        org.mockito.Mockito.verifyNoInteractions(entryMapper, gainedItemMapper, inventoryItemMapper);
    }

    private AdventureGainedItemRequest permanent(String name) {
        AdventureGainedItemRequest request = new AdventureGainedItemRequest();
        request.setItemName(name);
        request.setItemType("PERMANENT");
        return request;
    }
}
