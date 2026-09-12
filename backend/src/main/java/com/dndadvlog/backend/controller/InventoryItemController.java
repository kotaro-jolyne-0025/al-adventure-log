package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.InventoryItemRequest;
import com.dndadvlog.backend.dto.InventoryItemResponse;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.service.InventoryItemService;
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
@RequestMapping("/api/characters/{characterId}/inventory")
@RequiredArgsConstructor
public class InventoryItemController {

    private final InventoryItemService inventoryItemService;

    @GetMapping
    public List<InventoryItemResponse> getItems(
            @PathVariable UUID characterId,
            @RequestParam(required = false) InventoryItem.ItemType type,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🎒 [GET /api/characters/{}/inventory] 查詢倉庫物品 (type={}), userId={}", characterId, type, principal.getId());
        return inventoryItemService.getItems(characterId, type, principal.getId());
    }

    @PostMapping
    public ResponseEntity<InventoryItemResponse> createItem(
            @PathVariable UUID characterId,
            @Valid @RequestBody InventoryItemRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("➕ [POST /api/characters/{}/inventory] 新增物品: {}, userId={}", characterId, request.getItemName(), principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryItemService.createItem(characterId, request, principal.getId()));
    }

    @PutMapping("/{itemId}")
    public InventoryItemResponse updateItem(
            @PathVariable UUID characterId,
            @PathVariable UUID itemId,
            @Valid @RequestBody InventoryItemRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("✏️ [PUT /api/characters/{}/inventory/{}] 更新物品: {}, userId={}", characterId, itemId, request.getItemName(), principal.getId());
        return inventoryItemService.updateItem(characterId, itemId, request, principal.getId());
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable UUID characterId,
            @PathVariable UUID itemId,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🗑️ [DELETE /api/characters/{}/inventory/{}] 刪除物品, userId={}", characterId, itemId, principal.getId());
        inventoryItemService.deleteItem(characterId, itemId, principal.getId());
        return ResponseEntity.noContent().build();
    }
}
