package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureEntryRequest;
import com.dndadvlog.backend.dto.AdventureEntryResponse;
import com.dndadvlog.backend.dto.ClassLevelChangeRequest;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdventureLedgerServiceTest {

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

    @BeforeEach
    void emptyChildren() {
        lenient().when(downtimeActivityMapper.findByEntryIdOrderByCreatedAtAsc(any()))
                .thenReturn(List.of());
        lenient().when(storyAwardMapper.findByAdventureEntryId(any())).thenReturn(List.of());
    }

    @Test
    void createWithoutPreviousSnapshotUsesCharacterBaselineAndAccumulatesCurrentState() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)1", "0.00", 0);
        AtomicReference<AdventureEntry> stored = arrangeCreate(character);
        AdventureEntryRequest request = request(LocalDate.of(2026, 9, 18), 1, "戰士 (Fighter)", 1,
                "50.00", 2);

        AdventureEntryResponse response = service.createEntry(characterId, request, userId);

        assertEquals(2, response.getRecordingModelVersion());
        assertEquals(1, response.getStartingLevel());
        assertEquals(2, response.getEndingLevel());
        assertEquals("Fighter1", response.getStartingClassesString());
        assertEquals("Fighter2", response.getEndingClassesString());
        assertMoney("0.00", response.getStartingGold());
        assertMoney("50.00", response.getGoldTotal());
        assertEquals(0, response.getStartingDowntime());
        assertEquals(2, response.getDowntimeTotal());
        assertEquals("Fighter2", character.getCurrentClassesString());
        assertMoney("50.00", character.getCurrentGold());
        assertEquals(2, character.getCurrentDowntime());
        assertEquals(stored.get().getId(), response.getId());
    }

    @Test
    void firstAdventureStartsFromOpeningResourceAndUnlinkedInventoryBaselines() {
        Character character = character("Barbarian1", "Barbarian1", "50.00", 4);
        character.setInitialGold(new BigDecimal("50.00"));
        character.setInitialDowntime(4);
        when(inventoryItemMapper.sumUnlinkedPermanentQuantityByCharacterId(characterId)).thenReturn(3);
        AtomicReference<AdventureEntry> stored = arrangeCreate(character);

        AdventureEntryResponse response = service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 19), 0, null, 0, "0", 0), userId);

        assertEquals("Barbarian1", response.getStartingClassesString());
        assertEquals(0, response.getStartingGold().compareTo(new BigDecimal("50.00")));
        assertEquals(4, response.getStartingDowntime());
        assertEquals(3, response.getStartingMagicItems());
        assertEquals(3, stored.get().getStartingMagicItems());
    }

    @Test
    void firstAdventureSynchronizesAStaleCurrentClassToItsEndingSnapshot() {
        Character character = character("Fighter5", "Barbarian1", "0.00", 0);
        arrangeCreate(character);

        service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 20), 0, null, 0, "0", 0), userId);

        assertEquals("Fighter5", character.getCurrentClassesString());
    }

    @Test
    void firstAdventureCanIncreaseItsOpeningClassUsingAnAlias() {
        Character character = character("野蠻人1", "野蠻人1", "0.00", 0);
        arrangeCreate(character);

        AdventureEntryResponse response = service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 20), 1, "野蠻人", 1, "0", 0), userId);

        assertEquals("Barbarian1", response.getStartingClassesString());
        assertEquals("Barbarian2", response.getEndingClassesString());
        assertEquals("Barbarian2", character.getCurrentClassesString());
    }

    @Test
    void contributionCombinesMixedLegacyClassAliasesIntoOneEnglishIdentifier() {
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 20), "Barbarian2", 2, "0", 0, 0);
        entry.setStartingClassesString("野蠻人1");

        assertEquals(java.util.Map.of("Barbarian", 1), AdventureContribution.from(entry).classes());
    }

    @Test
    void rejectsUnsupportedClassNameBeforeSavingAdventure() {
        Character character = character("Barbarian1", "Barbarian1", "0.00", 0);
        when(characterService.findCharacter(characterId, userId)).thenReturn(character);

        assertThrows(BusinessException.class, () -> service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 20), 1, "Homebrew", 1, "0", 0), userId));
    }

    @Test
    void backdatedCreateUsesDatePredecessorButStillAddsToCurrentCharacter() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)5", "180.00", 4);
        AtomicReference<AdventureEntry> stored = arrangeCreate(character);
        AdventureEntry previous = snapshot(LocalDate.of(2026, 8, 20), "戰士 (Fighter)3", 3,
                "100.00", 2, 1);
        when(entryMapper.findPreviousForNew(characterId, LocalDate.of(2026, 9, 1))).thenReturn(previous);
        when(entryMapper.existsByCharacterId(characterId)).thenReturn(true);

        AdventureEntryResponse response = service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 1), 1, "戰士 (Fighter)", 1, "30.00", 1), userId);

        assertEquals(3, response.getStartingLevel());
        assertEquals(4, response.getEndingLevel());
        assertMoney("100.00", response.getStartingGold());
        assertMoney("130.00", response.getGoldTotal());
        assertEquals("Fighter6", character.getCurrentClassesString());
        assertMoney("210.00", character.getCurrentGold());
        assertEquals(5, character.getCurrentDowntime());
        assertEquals(stored.get().getId(), response.getId());
    }

    @Test
    void editAppliesOnlyDifferenceAndRepeatedSaveIsIdempotent() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)2", "30.00", 1);
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 18), "戰士 (Fighter)2", 2,
                "30.00", 1, 0);
        entry.setStartingClassesString("戰士 (Fighter)1");
        entry.setStartingLevel(1);
        entry.setGoldChange(new BigDecimal("30.00"));
        entry.setDowntimeChange(1);
        entry.setRecordingModelVersion(2);
        arrangeUpdate(character, entry);

        AdventureEntryRequest request = request(entry.getPlayDate(), 2, "戰士 (Fighter)", 2,
                "40.00", 3);
        service.updateEntry(entry.getId(), request, userId);
        service.updateEntry(entry.getId(), request, userId);

        assertEquals("Fighter3", character.getCurrentClassesString());
        assertMoney("40.00", character.getCurrentGold());
        assertEquals(3, character.getCurrentDowntime());
        verify(characterMapper, org.mockito.Mockito.times(2)).update(character);
    }

    @Test
    void editCanLowerAnExistingPositiveContribution() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)5", "0", 0);
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 18), "戰士 (Fighter)5", 5,
                "0", 0, 0);
        entry.setStartingClassesString("戰士 (Fighter)1");
        entry.setStartingLevel(1);
        entry.setGoldChange(BigDecimal.ZERO);
        entry.setDowntimeChange(0);
        entry.setRecordingModelVersion(2);
        arrangeUpdate(character, entry);

        service.updateEntry(entry.getId(),
                request(entry.getPlayDate(), 1, "戰士 (Fighter)", 1, "0", 0), userId);

        assertEquals("Fighter2", character.getCurrentClassesString());
    }

    @Test
    void changingOnlyDateRecalculatesThatSnapshotWithoutChangingCurrentStateOrOtherSnapshots() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)5", "80.00", 3);
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 18), "戰士 (Fighter)5", 5,
                "80.00", 3, 0);
        entry.setStartingClassesString("戰士 (Fighter)1");
        entry.setStartingLevel(1);
        entry.setGoldChange(new BigDecimal("80.00"));
        entry.setDowntimeChange(3);
        entry.setRecordingModelVersion(1);
        arrangeUpdate(character, entry);

        AdventureEntryRequest sameContribution = request(
                LocalDate.of(2026, 9, 1), 4, "戰士 (Fighter)", 4, "80.00", 3);
        sameContribution.setAdventureName("Renamed");
        service.updateEntry(entry.getId(), sameContribution, userId);

        assertEquals("Fighter5", character.getCurrentClassesString());
        assertMoney("80.00", character.getCurrentGold());
        assertEquals(3, character.getCurrentDowntime());
        verify(characterMapper).update(character);
        verify(entryMapper).findPreviousForExisting(
                characterId, LocalDate.of(2026, 9, 1), entry.getCreatedAt(), entry.getId());
        verify(entryMapper).update(entry);
    }

    @Test
    void legacyMetadataOnlyEditKeepsVersionOneSnapshotsAndCurrentState() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)5", "80.00", 3);
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 18), "戰士 (Fighter)5", 5,
                "80.00", 3, 0);
        entry.setStartingClassesString("戰士 (Fighter)1");
        entry.setStartingLevel(1);
        entry.setGoldChange(new BigDecimal("80.00"));
        entry.setDowntimeChange(3);
        entry.setRecordingModelVersion(1);
        arrangeUpdate(character, entry);

        AdventureEntryRequest metadataOnly = new AdventureEntryRequest();
        metadataOnly.setAdventureName("Renamed legacy");
        service.updateEntry(entry.getId(), metadataOnly, userId);

        assertEquals(1, entry.getRecordingModelVersion());
        assertEquals(5, entry.getEndingLevel());
        assertMoney("80.00", character.getCurrentGold());
        verify(characterMapper, never()).update(any());
    }

    @Test
    void deleteReversesOnlySavedContributionAndAllowsNegativeResources() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)2", "20.00", 2);
        AdventureEntry entry = snapshot(LocalDate.of(2026, 9, 1), "戰士 (Fighter)2", 2,
                "100.00", 10, 0);
        entry.setStartingClassesString("戰士 (Fighter)1");
        entry.setStartingLevel(1);
        entry.setStartingGold(BigDecimal.ZERO);
        entry.setGoldChange(new BigDecimal("100.00"));
        entry.setStartingDowntime(0);
        entry.setDowntimeChange(10);
        when(entryMapper.findByIdAndUserId(entry.getId(), userId)).thenReturn(entry);
        when(characterService.findCharacter(characterId, userId)).thenReturn(character);

        service.deleteEntry(entry.getId(), userId);

        assertEquals("Fighter1", character.getCurrentClassesString());
        assertMoney("-80.00", character.getCurrentGold());
        assertEquals(-8, character.getCurrentDowntime());
        verify(entryMapper).deleteById(entry.getId());
        verify(characterMapper).update(character);
    }

    @Test
    void backdatedSnapshotWarnsWithoutUpdatingTheNextRecord() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)5", "0.00", 0);
        AtomicReference<AdventureEntry> stored = arrangeCreate(character);
        AdventureEntry next = snapshot(LocalDate.of(2026, 9, 18), "戰士 (Fighter)5", 5,
                "0.00", 0, 0);
        next.setStartingClassesString("戰士 (Fighter)1");
        next.setStartingLevel(1);
        when(entryMapper.findNextForExisting(any(), any(), any(), any())).thenReturn(next);
        when(entryMapper.existsByCharacterId(characterId)).thenReturn(true);

        AdventureEntryResponse response = service.createEntry(characterId,
                request(LocalDate.of(2026, 9, 1), 1, "戰士 (Fighter)", 1, "0.00", 0), userId);

        assertFalse(response.getWarnings().isEmpty());
        verify(entryMapper, never()).update(next);
        assertEquals(5, next.getEndingLevel());
        assertEquals(stored.get().getId(), response.getId());
    }

    @Test
    void negativeMagicItemChangeWarnsWithoutGuessingInventoryDeletion() {
        Character character = character("戰士 (Fighter)1", "戰士 (Fighter)1", "0", 0);
        arrangeCreate(character);
        AdventureEntry previous = snapshot(LocalDate.of(2026, 9, 1), "戰士 (Fighter)1", 1,
                "0", 0, 2);
        when(entryMapper.findPreviousForNew(characterId, LocalDate.of(2026, 9, 2))).thenReturn(previous);
        AdventureEntryRequest request = request(LocalDate.of(2026, 9, 2), 0, null, 0, "0", 0);
        request.setMagicItemsChange(-1);

        AdventureEntryResponse response = service.createEntry(characterId, request, userId);

        assertEquals(1, response.getMagicItemsTotal());
        assertTrue(response.getWarnings().stream().anyMatch(message -> message.contains("請至倉庫")));
        verify(inventoryItemMapper, never()).insert(any());
        verify(inventoryItemMapper, never()).deleteById(any());
    }

    @Test
    void supportsMulticlassIncreaseAndRejectsLevelAboveTwenty() {
        Character character = character(
                "戰士 (Fighter)1/法師 (Wizard)1",
                "戰士 (Fighter)1/法師 (Wizard)1",
                "0.00", 0);
        arrangeCreate(character);
        AdventureEntryRequest multiclass = request(LocalDate.of(2026, 9, 1), 0, null, 0, "0", 0);
        multiclass.setLevelChange(2);
        multiclass.setClassChanges(List.of(
                classChange("戰士 (Fighter)", 1),
                classChange("法師 (Wizard)", 1)));

        AdventureEntryResponse response = service.createEntry(characterId, multiclass, userId);
        assertEquals("Fighter2/Wizard2", response.getEndingClassesString());

        Character maxed = character("戰士 (Fighter)20", "戰士 (Fighter)20", "0", 0);
        when(characterService.findCharacter(characterId, userId)).thenReturn(maxed);
        AdventureEntryRequest tooHigh = request(LocalDate.of(2026, 9, 2), 1,
                "戰士 (Fighter)", 1, "0", 0);
        assertThrows(BusinessException.class,
                () -> service.createEntry(characterId, tooHigh, userId));
    }

    private AtomicReference<AdventureEntry> arrangeCreate(Character character) {
        AtomicReference<AdventureEntry> stored = new AtomicReference<>();
        when(characterService.findCharacter(characterId, userId)).thenReturn(character);
        doAnswer(invocation -> {
            AdventureEntry entry = invocation.getArgument(0);
            entry.setCreatedAt(LocalDateTime.of(2026, 9, 19, 10, 0));
            stored.set(entry);
            return null;
        }).when(entryMapper).insert(any());
        when(entryMapper.findById(any())).thenAnswer(invocation -> stored.get());
        return stored;
    }

    private void arrangeUpdate(Character character, AdventureEntry entry) {
        when(characterService.findCharacter(characterId, userId)).thenReturn(character);
        when(entryMapper.findByIdAndUserId(entry.getId(), userId)).thenReturn(entry);
        when(entryMapper.findById(entry.getId())).thenReturn(entry);
    }

    private Character character(String initial, String current, String gold, int downtime) {
        Character character = new Character();
        character.setId(characterId);
        character.setInitialClassesString(initial);
        character.setCurrentClassesString(current);
        character.setCurrentGold(new BigDecimal(gold));
        character.setCurrentDowntime(downtime);
        character.setCurrentMagicItems(0);
        return character;
    }

    private AdventureEntry snapshot(
            LocalDate date, String endingClasses, int endingLevel,
            String goldTotal, int downtimeTotal, int magicItemsTotal) {
        AdventureEntry entry = new AdventureEntry();
        entry.setId(UUID.randomUUID());
        entry.setCharacterId(characterId);
        entry.setPlayDate(date);
        entry.setCreatedAt(LocalDateTime.of(2026, 9, 18, 10, 0));
        entry.setEndingClassesString(endingClasses);
        entry.setEndingLevel(endingLevel);
        entry.setGoldTotal(new BigDecimal(goldTotal));
        entry.setDowntimeTotal(downtimeTotal);
        entry.setMagicItemsTotal(magicItemsTotal);
        return entry;
    }

    private AdventureEntryRequest request(
            LocalDate date, int levelChange, String className, int classLevelChange,
            String goldChange, int downtimeChange) {
        AdventureEntryRequest request = new AdventureEntryRequest();
        request.setPlayDate(date);
        request.setLevelChange(levelChange);
        request.setClassChanges(className == null
                ? List.of() : List.of(classChange(className, classLevelChange)));
        request.setGoldChange(new BigDecimal(goldChange));
        request.setGoldDowntimeChange(BigDecimal.ZERO);
        request.setDowntimeChange(downtimeChange);
        request.setDowntimeDowntimeChange(0);
        request.setMagicItemsChange(0);
        request.setMagicItemsDowntimeChange(0);
        return request;
    }

    private ClassLevelChangeRequest classChange(String name, int levels) {
        ClassLevelChangeRequest change = new ClassLevelChangeRequest();
        change.setClassName(name);
        change.setLevelChange(levels);
        return change;
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, actual.compareTo(new BigDecimal(expected)));
    }
}
