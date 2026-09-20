package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.CharacterRequest;
import com.dndadvlog.backend.dto.CharacterResponse;
import com.dndadvlog.backend.dto.CharacterBaselineRequest;
import com.dndadvlog.backend.dto.CharacterBaselinePreviewResponse;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CharacterService {

    private final CharacterMapper characterMapper;
    private final AdventureEntryMapper adventureEntryMapper;

    public List<CharacterResponse> getAllCharacters(UUID userId) {
        return characterMapper.findByUserId(userId)
                .stream().map(character -> toResponse(character, false)).toList();
    }

    public CharacterResponse getCharacter(UUID id, UUID userId) {
        return toResponse(findCharacter(id, userId), true);
    }

    @Transactional
    public CharacterResponse createCharacter(CharacterRequest request, UUID userId) {
        Character character = new Character();
        character.setId(UUID.randomUUID());
        character.setUserId(userId);
        character.setCharacterName(request.getCharacterName());
        character.setPlayerName(request.getPlayerName());
        character.setRace(request.getRace());
        character.setSubclass(request.getSubclass());
        character.setFaction(request.getFaction());
        character.setAvatarUrl(request.getAvatarUrl());
        String requestedClasses = request.getInitialClassesString() != null
                ? request.getInitialClassesString() : request.getCurrentClassesString();
        String classes = DndClassNames.canonicalizeInput(requestedClasses);
        character.setInitialClassesString(classes);
        character.setCurrentClassesString(classes);
        character.setInitialGold(request.getInitialGold() != null ? request.getInitialGold() : BigDecimal.ZERO);
        character.setInitialDowntime(request.getInitialDowntime() != null ? request.getInitialDowntime() : 0);
        character.setCurrentGold(character.getInitialGold());
        character.setCurrentDowntime(character.getInitialDowntime());
        character.setCurrentMagicItems(0);
        character.setSoulCoins(request.getSoulCoins() != null ? request.getSoulCoins() : 0);
        characterMapper.insert(character);
        log.info("角色建立成功: ID={}, UserID={}, 名稱={}", character.getId(), userId, character.getCharacterName());
        return toResponse(findCharacter(character.getId(), userId), false);
    }

    @Transactional
    public CharacterResponse updateCharacter(UUID id, CharacterRequest request, UUID userId) {
        Character character = findCharacter(id, userId);
        character.setCharacterName(request.getCharacterName());
        character.setPlayerName(request.getPlayerName());
        character.setRace(request.getRace());
        character.setSubclass(request.getSubclass());
        character.setFaction(request.getFaction());
        character.setAvatarUrl(request.getAvatarUrl());
        String requestedClasses = request.getInitialClassesString() != null
                ? request.getInitialClassesString() : request.getCurrentClassesString();
        String initialClasses = requestedClasses != null
                ? DndClassNames.canonicalizeInput(requestedClasses) : character.getInitialClassesString();
        BigDecimal initialGold = request.getInitialGold() != null
                ? request.getInitialGold() : orZero(character.getInitialGold());
        int initialDowntime = request.getInitialDowntime() != null
                ? request.getInitialDowntime() : orZero(character.getInitialDowntime());
        character.setInitialClassesString(initialClasses);
        character.setInitialGold(initialGold);
        character.setInitialDowntime(initialDowntime);
        applyOpeningBaseline(character, initialClasses, initialGold, initialDowntime);
        if (request.getSoulCoins() != null) {
            character.setSoulCoins(request.getSoulCoins());
        }
        characterMapper.update(character);
        Character updated = findCharacter(id, userId);
        log.info("角色基本資料更新成功: ID={}, UserID={}, 名稱={}", updated.getId(), userId, updated.getCharacterName());
        return toResponse(updated, true);
    }

    public CharacterBaselinePreviewResponse previewOpeningBaseline(
            UUID id, CharacterBaselineRequest request, UUID userId) {
        Character character = findCharacter(id, userId);
        String classes = request.getInitialClassesString() != null
                ? DndClassNames.canonicalizeInput(request.getInitialClassesString())
                : character.getInitialClassesString();
        BigDecimal gold = request.getInitialGold() != null ? request.getInitialGold() : orZero(character.getInitialGold());
        int downtime = request.getInitialDowntime() != null
                ? request.getInitialDowntime() : orZero(character.getInitialDowntime());
        CharacterStateCalculator.State state = calculateOpeningState(character.getId(), classes, gold, downtime);
        return new CharacterBaselinePreviewResponse(state.classesString(), state.gold(), state.downtime());
    }

    private void applyOpeningBaseline(Character character, String classes, BigDecimal gold, int downtime) {
        CharacterStateCalculator.State state = calculateOpeningState(character.getId(), classes, gold, downtime);
        character.setCurrentClassesString(state.classesString());
        character.setCurrentGold(state.gold());
        character.setCurrentDowntime(state.downtime());
    }

    private CharacterStateCalculator.State calculateOpeningState(
            UUID characterId, String classes, BigDecimal gold, int downtime) {
        List<AdventureEntry> entries = adventureEntryMapper.findByCharacterIdOrderByPlayDateAsc(characterId);
        return CharacterStateCalculator.fromOpeningBaseline(classes, gold, downtime, entries);
    }

    @Transactional
    public void deleteCharacter(UUID id, UUID userId) {
        findCharacter(id, userId);
        characterMapper.deleteById(id);
        log.info("角色刪除成功: ID={}, UserID={}", id, userId);
    }

    public Character findCharacter(UUID id, UUID userId) {
        Character character = characterMapper.findByIdAndUserId(id, userId);
        if (character == null) {
            throw new ResourceNotFoundException("找不到角色 ID：" + id);
        }
        return character;
    }

    public Character findCharacterInternal(UUID id) {
        Character character = characterMapper.findById(id);
        if (character == null) {
            throw new ResourceNotFoundException("找不到角色 ID：" + id);
        }
        return character;
    }

    private CharacterResponse toResponse(Character character, boolean includeAdventurePresence) {
        CharacterResponse response = new CharacterResponse();
        response.setId(character.getId());
        response.setUserId(character.getUserId());
        response.setCharacterName(character.getCharacterName());
        response.setPlayerName(character.getPlayerName());
        response.setRace(character.getRace());
        response.setSubclass(character.getSubclass());
        response.setFaction(character.getFaction());
        response.setAvatarUrl(character.getAvatarUrl());
        response.setInitialClassesString(character.getInitialClassesString());
        response.setInitialGold(orZero(character.getInitialGold()));
        response.setInitialDowntime(orZero(character.getInitialDowntime()));
        response.setCreatedAt(character.getCreatedAt());
        response.setUpdatedAt(character.getUpdatedAt());
        response.setCurrentClassesString(character.getCurrentClassesString());
        response.setCurrentGold(character.getCurrentGold());
        response.setCurrentDowntime(character.getCurrentDowntime());
        response.setCurrentMagicItems(character.getCurrentMagicItems());
        response.setSoulCoins(character.getSoulCoins());
        response.setHasAdventureEntries(includeAdventurePresence && adventureEntryMapper.existsByCharacterId(character.getId()));
        return response;
    }

    private BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private int orZero(Integer value) {
        return value == null ? 0 : value;
    }
}
