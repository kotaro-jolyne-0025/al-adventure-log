package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.CharacterRequest;
import com.dndadvlog.backend.dto.CharacterResponse;
import com.dndadvlog.backend.dto.CharacterBaselineRequest;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CharacterServiceTest {

    @Mock
    private CharacterMapper characterMapper;
    @Mock
    private AdventureEntryMapper adventureEntryMapper;

    @InjectMocks
    private CharacterService service;

    @Test
    void createInitializesBaselineAndMaterializedResources() {
        UUID userId = UUID.randomUUID();
        AtomicReference<Character> stored = new AtomicReference<>();
        doAnswer(invocation -> {
            stored.set(invocation.getArgument(0));
            return null;
        }).when(characterMapper).insert(any(Character.class));
        when(characterMapper.findByIdAndUserId(any(UUID.class), any(UUID.class)))
                .thenAnswer(invocation -> stored.get());

        CharacterRequest request = request("戰士 (Fighter)5");
        CharacterResponse response = service.createCharacter(request, userId);

        assertEquals("Fighter5", response.getInitialClassesString());
        assertEquals("Fighter5", response.getCurrentClassesString());
        assertEquals(0, response.getCurrentGold().compareTo(BigDecimal.ZERO));
        assertEquals(0, response.getCurrentDowntime());
        assertEquals(0, response.getCurrentMagicItems());
    }

    @Test
    void profileUpdatePreservesBaselineAndCurrentResources() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character stored = new Character();
        stored.setId(characterId);
        stored.setUserId(userId);
        stored.setCharacterName("Before");
        stored.setRace("Human");
        stored.setInitialClassesString("Fighter1");
        stored.setCurrentClassesString("Fighter3");
        stored.setCurrentGold(new BigDecimal("42.50"));
        stored.setCurrentDowntime(7);
        stored.setCurrentMagicItems(2);
        when(characterMapper.findByIdAndUserId(characterId, userId)).thenReturn(stored);
        AdventureEntry entry = new AdventureEntry();
        entry.setStartingClassesString("Fighter1");
        entry.setEndingClassesString("Fighter3");
        entry.setGoldChange(new BigDecimal("42.50"));
        entry.setDowntimeChange(7);
        when(adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(entry));

        CharacterRequest request = request(null);
        request.setCharacterName("After");
        CharacterResponse response = service.updateCharacter(characterId, request, userId);

        verify(characterMapper).update(stored);
        assertEquals("Fighter1", response.getInitialClassesString());
        assertEquals("Fighter3", response.getCurrentClassesString());
        assertEquals(0, response.getCurrentGold().compareTo(new BigDecimal("42.50")));
        assertEquals(7, response.getCurrentDowntime());
        assertEquals(2, response.getCurrentMagicItems());
    }

    @Test
    void profileUpdateRestoresOpeningStateWhenCharacterHasNoAdventures() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character stored = new Character();
        stored.setId(characterId);
        stored.setUserId(userId);
        stored.setCharacterName("Test");
        stored.setRace("Human");
        stored.setInitialClassesString("Fighter5");
        stored.setCurrentClassesString("Barbarian1");
        when(characterMapper.findByIdAndUserId(characterId, userId)).thenReturn(stored);
        when(adventureEntryMapper.existsByCharacterId(characterId)).thenReturn(false);
        when(adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of());

        CharacterResponse response = service.updateCharacter(characterId, request(null), userId);

        assertEquals("Fighter5", response.getInitialClassesString());
        assertEquals("Fighter5", response.getCurrentClassesString());
        verify(characterMapper).update(stored);
    }

    @Test
    void openingBaselinePreviewRecalculatesCurrentStateWithoutWriting() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character character = new Character();
        character.setId(characterId);
        character.setUserId(userId);
        character.setInitialClassesString("Fighter5");
        character.setCurrentClassesString("Barbarian1");
        character.setInitialGold(new BigDecimal("10.00"));
        character.setInitialDowntime(2);
        AdventureEntry unchanged = new AdventureEntry();
        unchanged.setStartingClassesString("Fighter5");
        unchanged.setEndingClassesString("Fighter5");
        unchanged.setStartingGold(new BigDecimal("10.00"));
        unchanged.setGoldChange(BigDecimal.ZERO);
        unchanged.setGoldDowntimeChange(BigDecimal.ZERO);
        unchanged.setGoldTotal(new BigDecimal("10.00"));
        unchanged.setStartingDowntime(2);
        unchanged.setDowntimeChange(0);
        unchanged.setDowntimeDowntimeChange(0);
        unchanged.setDowntimeTotal(2);
        when(characterMapper.findByIdAndUserId(characterId, userId)).thenReturn(character);
        when(adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(unchanged));

        CharacterBaselineRequest request = new CharacterBaselineRequest();
        request.setInitialClassesString("Barbarian1");
        request.setInitialGold(new BigDecimal("25.00"));
        request.setInitialDowntime(4);
        var preview = service.previewOpeningBaseline(characterId, request, userId);

        assertEquals("Barbarian1", preview.getCurrentClassesString());
        assertEquals(0, preview.getCurrentGold().compareTo(new BigDecimal("25.00")));
        assertEquals(4, preview.getCurrentDowntime());
        verify(characterMapper, never()).update(any());
    }

    @Test
    void profileSaveReconcilesAStaleCurrentClassFromExistingSnapshots() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character character = new Character();
        character.setId(characterId);
        character.setUserId(userId);
        character.setInitialClassesString("Fighter5");
        character.setCurrentClassesString("Barbarian1");
        AdventureEntry entry = new AdventureEntry();
        entry.setStartingClassesString("Fighter5");
        entry.setEndingClassesString("Fighter5");
        when(characterMapper.findByIdAndUserId(characterId, userId)).thenReturn(character);
        when(adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(entry));

        CharacterResponse response = service.updateCharacter(characterId, request(null), userId);

        assertEquals("Fighter5", response.getCurrentClassesString());
        verify(characterMapper).update(character);
    }

    @Test
    void updatingOpeningBaselineRecalculatesCharacterFromSavedContributions() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Character stored = new Character();
        stored.setId(characterId);
        stored.setUserId(userId);
        stored.setCharacterName("Hero");
        stored.setRace("Human");
        stored.setInitialClassesString("Fighter1");
        stored.setCurrentClassesString("Fighter3");
        stored.setInitialGold(new BigDecimal("10.00"));
        stored.setInitialDowntime(2);
        stored.setCurrentGold(new BigDecimal("50.00"));
        stored.setCurrentDowntime(3);
        AdventureEntry adventure = new AdventureEntry();
        adventure.setStartingClassesString("Fighter1");
        adventure.setEndingClassesString("Fighter3");
        adventure.setGoldChange(new BigDecimal("40.00"));
        adventure.setDowntimeChange(1);
        when(characterMapper.findByIdAndUserId(characterId, userId)).thenReturn(stored);
        when(adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of(adventure));
        when(adventureEntryMapper.existsByCharacterId(characterId)).thenReturn(true);

        CharacterRequest request = request("Barbarian1");
        request.setInitialClassesString("Barbarian1");
        request.setInitialGold(new BigDecimal("20.00"));
        request.setInitialDowntime(4);
        CharacterResponse response = service.updateCharacter(characterId, request, userId);

        assertEquals("Barbarian1/Fighter2", response.getCurrentClassesString());
        assertEquals(0, response.getCurrentGold().compareTo(new BigDecimal("60.00")));
        assertEquals(5, response.getCurrentDowntime());
        assertEquals("Fighter1", adventure.getStartingClassesString());
        verify(characterMapper).update(stored);
    }

    private CharacterRequest request(String classes) {
        CharacterRequest request = new CharacterRequest();
        request.setCharacterName("Hero");
        request.setRace("Human");
        request.setCurrentClassesString(classes);
        return request;
    }
}
