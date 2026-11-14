package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.service.InventoryMovementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/characters/{characterId}/inventory")
public class InventoryMovementController {
    private final InventoryMovementService service;

    @GetMapping("/movements")
    public InventoryMovementService.Page page(@PathVariable UUID characterId,
            @RequestParam(required=false) String cursor, @RequestParam(defaultValue="50") int limit,
            @RequestParam(required=false) String usageAdventureEntryId,
            @RequestParam(required=false) String reversed,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (reversed != null && !reversed.equals("true") && !reversed.equals("false")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        UUID entryId = null;
        if (usageAdventureEntryId != null) {
            try {
                entryId = UUID.fromString(usageAdventureEntryId);
                if (!entryId.toString().equalsIgnoreCase(usageAdventureEntryId)) throw new IllegalArgumentException();
            } catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
        }
        return service.page(characterId, principal.getId(), cursor, limit, entryId,
            reversed == null ? null : Boolean.valueOf(reversed));
    }

    @PostMapping("/{itemId}/consume")
    public InventoryItemResponse consume(@PathVariable UUID characterId, @PathVariable UUID itemId,
            @Valid @RequestBody InventoryConsumeRequest request,
            @RequestHeader(value="X-Expected-Updated-At",required=false) String expected,
            @AuthenticationPrincipal UserPrincipal principal) {
        return service.consume(characterId,itemId,principal.getId(),expected,request);
    }

    @PatchMapping("/movements/{movementId}/usage-adventure")
    public InventoryMovementResponse updateUsage(@PathVariable UUID characterId, @PathVariable UUID movementId,
            @RequestBody InventoryUsageRequest request,
            @RequestHeader(value="X-Expected-Updated-At",required=false) String expected,
            @AuthenticationPrincipal UserPrincipal principal) {
        return service.updateUsage(characterId,movementId,principal.getId(),expected,request);
    }

    @PostMapping("/movements/{movementId}/reverse")
    public InventoryMovementResponse reverse(@PathVariable UUID characterId, @PathVariable UUID movementId,
            @RequestHeader(value="X-Expected-Updated-At",required=false) String expected,
            @AuthenticationPrincipal UserPrincipal principal) {
        return service.reverse(characterId,movementId,principal.getId(),expected);
    }
}
