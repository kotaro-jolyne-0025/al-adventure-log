package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.CharacterRequest;
import com.dndadvlog.backend.dto.CharacterResponse;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.CharacterMapper;
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
public class CharacterService {

    private final CharacterMapper characterMapper;

    public List<CharacterResponse> getAllCharacters(UUID userId) {
        return characterMapper.findByUserId(userId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public CharacterResponse getCharacter(UUID id, UUID userId) {
        return toResponse(findCharacter(id, userId));
    }

    @Transactional
    public CharacterResponse createCharacter(CharacterRequest request, UUID userId) {
        Character character = new Character();
        character.setId(UUID.randomUUID());
        character.setUserId(userId);
        character.setCharacterName(request.getCharacterName());
        character.setPlayerName(request.getPlayerName());
        character.setRace(request.getRace());
        character.setFaction(request.getFaction());
        character.setCurrentClassesString(request.getCurrentClassesString());
        characterMapper.insert(character);
        log.info("角色建立成功: ID={}, UserID={}, 名稱={}", character.getId(), userId, character.getCharacterName());
        return toResponse(findCharacter(character.getId(), userId));
    }

    @Transactional
    public CharacterResponse updateCharacter(UUID id, CharacterRequest request, UUID userId) {
        Character character = findCharacter(id, userId);
        character.setCharacterName(request.getCharacterName());
        character.setPlayerName(request.getPlayerName());
        character.setRace(request.getRace());
        if (request.getCurrentClassesString() != null) {
            character.setCurrentClassesString(request.getCurrentClassesString());
        }
        characterMapper.update(character);
        Character updated = findCharacter(id, userId);
        log.info("角色基本資料更新成功: ID={}, UserID={}, 名稱={}", updated.getId(), userId, updated.getCharacterName());
        return toResponse(updated);
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

    private CharacterResponse toResponse(Character character) {
        CharacterResponse response = new CharacterResponse();
        response.setId(character.getId());
        response.setUserId(character.getUserId());
        response.setCharacterName(character.getCharacterName());
        response.setPlayerName(character.getPlayerName());
        response.setRace(character.getRace());
        response.setFaction(character.getFaction());
        response.setCreatedAt(character.getCreatedAt());
        response.setUpdatedAt(character.getUpdatedAt());
        response.setCurrentClassesString(character.getCurrentClassesString());
        return response;
    }
}