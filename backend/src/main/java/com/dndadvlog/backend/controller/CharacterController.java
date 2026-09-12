package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.CharacterRequest;
import com.dndadvlog.backend.dto.CharacterResponse;
import com.dndadvlog.backend.service.CharacterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/characters")
@RequiredArgsConstructor
public class CharacterController {

    private final CharacterService characterService;

    @GetMapping
    public List<CharacterResponse> getAllCharacters(@AuthenticationPrincipal UserPrincipal principal) {
        log.info("📋 [GET /api/characters] 查詢使用者 {} 的所有角色", principal.getEmail());
        return characterService.getAllCharacters(principal.getId());
    }

    @GetMapping("/{id}")
    public CharacterResponse getCharacter(@PathVariable UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🔍 [GET /api/characters/{}] 查詢角色詳情, userId={}", id, principal.getId());
        return characterService.getCharacter(id, principal.getId());
    }

    @PostMapping
    public ResponseEntity<CharacterResponse> createCharacter(
            @Valid @RequestBody CharacterRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("➕ [POST /api/characters] 建立角色: 名稱={}, 玩家={}, userId={}",
                request.getCharacterName(), request.getPlayerName(), principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(characterService.createCharacter(request, principal.getId()));
    }

    @PutMapping("/{id}")
    public CharacterResponse updateCharacter(
            @PathVariable UUID id,
            @Valid @RequestBody CharacterRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("✏️ [PUT /api/characters/{}] 更新角色: 名稱={}, 玩家={}, userId={}",
                id, request.getCharacterName(), request.getPlayerName(), principal.getId());
        return characterService.updateCharacter(id, request, principal.getId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCharacter(@PathVariable UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🗑️ [DELETE /api/characters/{}] 刪除角色, userId={}", id, principal.getId());
        characterService.deleteCharacter(id, principal.getId());
        return ResponseEntity.noContent().build();
    }
}
