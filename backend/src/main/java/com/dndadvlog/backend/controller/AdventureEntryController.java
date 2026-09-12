package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.service.AdventureEntryService;
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
@RequiredArgsConstructor
public class AdventureEntryController {

    private final AdventureEntryService adventureEntryService;

    // Adventure Entries
    @GetMapping("/api/characters/{characterId}/entries")
    public List<AdventureEntryResponse> getEntries(
            @PathVariable UUID characterId,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("📜 [GET /api/characters/{}/entries] 查詢冒險記錄列表, userId={}", characterId, principal.getId());
        return adventureEntryService.getEntriesByCharacter(characterId, principal.getId());
    }

    @GetMapping("/api/characters/{characterId}/entries/defaults")
    public com.dndadvlog.backend.dto.EntryDefaultsResponse getDefaults(
            @PathVariable UUID characterId,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("⚙️ [GET /api/characters/{}/entries/defaults] 取得新記錄預設起始值, userId={}", characterId, principal.getId());
        return adventureEntryService.getDefaults(characterId, principal.getId());
    }

    @GetMapping("/api/entries/{id}")
    public AdventureEntryResponse getEntry(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🔍 [GET /api/entries/{}] 查詢冒險記錄詳情, userId={}", id, principal.getId());
        return adventureEntryService.getEntry(id, principal.getId());
    }

    @PostMapping("/api/characters/{characterId}/entries")
    public ResponseEntity<AdventureEntryResponse> createEntry(
            @PathVariable UUID characterId,
            @RequestBody AdventureEntryRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("➕ [POST /api/characters/{}/entries] 新增冒險記錄: 名稱={}, 代碼={}, userId={}",
                characterId, request.getAdventureName(), request.getAdventureCode(), principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adventureEntryService.createEntry(characterId, request, principal.getId()));
    }

    @PutMapping("/api/entries/{id}")
    public AdventureEntryResponse updateEntry(
            @PathVariable UUID id,
            @RequestBody AdventureEntryRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("✏️ [PUT /api/entries/{}] 更新冒險記錄: 名稱={}, 代碼={}, userId={}",
                id, request.getAdventureName(), request.getAdventureCode(), principal.getId());
        return adventureEntryService.updateEntry(id, request, principal.getId());
    }

    @DeleteMapping("/api/entries/{id}")
    public ResponseEntity<Void> deleteEntry(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🗑️ [DELETE /api/entries/{}] 刪除冒險記錄, userId={}", id, principal.getId());
        adventureEntryService.deleteEntry(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    // Downtime Activities
    @GetMapping("/api/entries/{entryId}/downtime-activities")
    public List<DowntimeActivityResponse> getActivities(
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🏕️ [GET /api/entries/{}/downtime-activities] 查詢休整期活動, userId={}", entryId, principal.getId());
        return adventureEntryService.getActivities(entryId, principal.getId());
    }

    @PostMapping("/api/entries/{entryId}/downtime-activities")
    public ResponseEntity<DowntimeActivityResponse> createActivity(
            @PathVariable UUID entryId,
            @RequestBody DowntimeActivityRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("➕ [POST /api/entries/{}/downtime-activities] 新增休整期活動: {}, userId={}", entryId, request.getDescription(), principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adventureEntryService.createActivity(entryId, request, principal.getId()));
    }

    @PutMapping("/api/downtime-activities/{id}")
    public DowntimeActivityResponse updateActivity(
            @PathVariable UUID id,
            @RequestBody DowntimeActivityRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("✏️ [PUT /api/downtime-activities/{}] 更新休整期活動, userId={}", id, principal.getId());
        return adventureEntryService.updateActivity(id, request, principal.getId());
    }

    @DeleteMapping("/api/downtime-activities/{id}")
    public ResponseEntity<Void> deleteActivity(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🗑️ [DELETE /api/downtime-activities/{}] 刪除休整期活動, userId={}", id, principal.getId());
        adventureEntryService.deleteActivity(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    // Gained Items (冒險獲得物品快照)
    @GetMapping("/api/entries/{entryId}/gained-items")
    public List<AdventureGainedItemResponse> getGainedItems(
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🎁 [GET /api/entries/{}/gained-items] 查詢冒險獲得物品快照, userId={}", entryId, principal.getId());
        return adventureEntryService.getGainedItems(entryId, principal.getId());
    }

    @PostMapping("/api/entries/{entryId}/gained-items")
    public ResponseEntity<AdventureGainedItemResponse> createGainedItem(
            @PathVariable UUID entryId,
            @RequestBody AdventureGainedItemRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("➕ [POST /api/entries/{}/gained-items] 新增冒險獲得物品快照: {}, userId={}", entryId, request.getItemName(), principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adventureEntryService.createGainedItem(entryId, request, principal.getId()));
    }

    @PutMapping("/api/entries/{entryId}/gained-items/{itemId}")
    public AdventureGainedItemResponse updateGainedItem(
            @PathVariable UUID entryId,
            @PathVariable UUID itemId,
            @RequestBody AdventureGainedItemRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("✏️ [PUT /api/entries/{}/gained-items/{}] 更新冒險獲得物品快照: {}, userId={}", entryId, itemId, request.getItemName(), principal.getId());
        return adventureEntryService.updateGainedItem(entryId, itemId, request, principal.getId());
    }

    @DeleteMapping("/api/gained-items/{id}")
    public ResponseEntity<Void> deleteGainedItem(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        log.info("🗑️ [DELETE /api/gained-items/{}] 刪除冒險獲得物品快照, userId={}", id, principal.getId());
        adventureEntryService.deleteGainedItem(id, principal.getId());
        return ResponseEntity.noContent().build();
    }
}
