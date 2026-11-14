package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InventoryMovementService {
    private final InventoryMovementMapper movements;
    private final InventoryItemMapper inventory;
    private final AdventureEntryMapper entries;
    private final CharacterService characters;
    private final MutationGuard guard;

    public static final String INVALID_QUANTITY = "請輸入不超過目前庫存的正整數。";
    public static final String CANNOT_REVERSE = "此物品已有後續異動或已移除，無法直接撤銷。請至倉庫調整數量。";

    public InventoryMovementResponse record(InventoryItem item, int before, int after,
            InventoryItem.ItemType previousType, String operation, String reason) {
        if (before == after && previousType == item.getItemType() && "ADJUST".equals(operation)) return null;
        InventoryMovementResponse m = new InventoryMovementResponse();
        m.setId(UUID.randomUUID());
        m.setCharacterId(item.getCharacterId());
        m.setItemId(item.getId());
        m.setItemName(item.getItemName());
        m.setItemType(item.getItemType().name());
        m.setPreviousItemType(previousType == null ? null : previousType.name());
        m.setOperation(operation);
        m.setReason(reason);
        m.setQuantityBefore(before);
        m.setQuantityDelta(Math.subtractExact(after, before));
        m.setQuantityAfter(after);
        m.setSourceEntryId(item.getAdventureEntryId());
        m.setSourceGainedItemId(item.getAdventureGainedItemId());
        AdventureEntry source = item.getAdventureEntryId() == null ? null : entries.findById(item.getAdventureEntryId());
        m.setSourceName(source == null ? item.getSource() : source.getAdventureName());
        m.setSourceCode(source == null ? null : source.getAdventureCode());
        return m;
    }

    public void save(InventoryItem item, int before, int after, InventoryItem.ItemType previousType, String operation, String reason) {
        InventoryMovementResponse movement = record(item, before, after, previousType, operation, reason);
        if (movement != null) movements.insert(movement);
    }

    public record Page(List<InventoryMovementResponse> items, String nextCursor) {}

    public Page page(UUID characterId, UUID userId, String cursor, int limit) {
        return page(characterId, userId, cursor, limit, null, null);
    }

    public Page page(UUID characterId, UUID userId, String cursor, int limit, UUID usageAdventureEntryId, Boolean reversed) {
        characters.findCharacter(characterId, userId);
        if ((usageAdventureEntryId == null) != (reversed == null)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (usageAdventureEntryId != null) {
            AdventureEntry entry = entries.findByIdAndUserId(usageAdventureEntryId, userId);
            if (entry == null || !characterId.equals(entry.getCharacterId())) throw new ResourceNotFoundException("找不到資料或資料已移除");
        }
        if (limit < 1 || limit > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        LocalDateTime time = null;
        UUID id = null;
        if (cursor != null) {
            try {
                String[] parts = cursor.split("\\|", -1);
                if (parts.length != 2) throw new IllegalArgumentException();
                time = LocalDateTime.parse(parts[0]);
                id = UUID.fromString(parts[1]);
            } catch (RuntimeException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
        }
        List<InventoryMovementResponse> rows = movements.page(characterId, time, id, limit + 1, usageAdventureEntryId, reversed);
        boolean more = rows.size() > limit;
        List<InventoryMovementResponse> items = more ? rows.subList(0, limit) : rows;
        InventoryMovementResponse last = items.isEmpty() ? null : items.get(items.size()-1);
        return new Page(items, more ? last.getCreatedAt() + "|" + last.getId() : null);
    }

    @Transactional
    public InventoryItemResponse consume(UUID characterId, UUID itemId, UUID userId, String expected,
            InventoryConsumeRequest request) {
        return guard.mutate(MutationGuard.Resource.ITEM, itemId, userId, expected, () -> {
            InventoryItem item = ownedItem(characterId, itemId, userId);
            int quantity;
            try { quantity = request.quantity().intValueExact(); }
            catch (RuntimeException ex) { throw new BusinessException(INVALID_QUANTITY); }
            if (item.getItemType() != InventoryItem.ItemType.CONSUMABLE || quantity <= 0 || quantity > item.getQuantity()) {
                throw new BusinessException(INVALID_QUANTITY);
            }
            if (request.notes() != null && request.notes().length() > 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            int before = item.getQuantity();
            item.setQuantity(before - quantity);
            InventoryMovementResponse m = record(item, before, item.getQuantity(), item.getItemType(), "CONSUME", "MANUAL");
            m.setNotes(request.notes());
            setUsage(m, request.usageAdventureEntryId(), characterId, userId);
            inventory.update(item);
            movements.insert(m);
            return InventoryItemService.toResponse(inventory.findById(itemId));
        });
    }

    @Transactional
    public InventoryMovementResponse updateUsage(UUID characterId, UUID id, UUID userId, String expected, InventoryUsageRequest request) {
        if (!request.isSupplied() && !request.isNotesSupplied()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (request.getNotes() != null && request.getNotes().length() > 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return guard.mutate(MutationGuard.Resource.MOVEMENT, id, userId, expected, () -> {
            InventoryMovementResponse m = ownedMovement(characterId, id, userId);
            if (!"CONSUME".equals(m.getOperation()) || m.isReversed()) throw new ResponseStatusException(HttpStatus.CONFLICT);
            if (request.isSupplied()) setUsage(m, request.getUsageAdventureEntryId(), characterId, userId);
            if (request.isNotesSupplied()) m.setNotes(request.getNotes());
            movements.updateUsage(m);
            return movements.findById(id);
        });
    }

    @Transactional
    public InventoryMovementResponse reverse(UUID characterId, UUID id, UUID userId, String expected) {
        return guard.mutate(MutationGuard.Resource.MOVEMENT, id, userId, expected, () -> {
            InventoryMovementResponse original = ownedMovement(characterId, id, userId);
            if (!original.isReversible() || original.isReversed()) throw new BusinessException(CANNOT_REVERSE);
            InventoryItem item = ownedItem(characterId, original.getItemId(), userId);
            return guard.mutate(MutationGuard.Resource.ITEM, item.getId(), userId, item.getUpdatedAt().toString(), () -> {
                int before = item.getQuantity();
                long after = (long) before - original.getQuantityDelta();
                if (after > Integer.MAX_VALUE) throw new BusinessException(INVALID_QUANTITY);
                item.setQuantity((int) after);
                InventoryMovementResponse reversal = record(item, before, item.getQuantity(), item.getItemType(), "REVERSE", "MANUAL");
                reversal.setReversalOf(id);
                reversal.setUsageEntryId(original.getUsageEntryId());
                reversal.setUsageOriginalEntryId(original.getUsageOriginalEntryId());
                reversal.setUsageName(original.getUsageName());
                reversal.setUsageCode(original.getUsageCode());
                inventory.update(item);
                movements.insert(reversal);
                return movements.findById(id);
            });
        });
    }

    private InventoryItem ownedItem(UUID characterId, UUID id, UUID userId) {
        characters.findCharacter(characterId, userId);
        InventoryItem item = inventory.findById(id);
        if (item == null || !characterId.equals(item.getCharacterId())) throw new ResourceNotFoundException("找不到資料或資料已移除");
        return item;
    }

    private InventoryMovementResponse ownedMovement(UUID characterId, UUID id, UUID userId) {
        characters.findCharacter(characterId, userId);
        InventoryMovementResponse m = movements.findById(id);
        if (m == null || !characterId.equals(m.getCharacterId())) throw new ResourceNotFoundException("找不到資料或資料已移除");
        return m;
    }

    private void setUsage(InventoryMovementResponse m, UUID entryId, UUID characterId, UUID userId) {
        AdventureEntry entry = entryId == null ? null : entries.findByIdAndUserId(entryId, userId);
        if (entryId != null && (entry == null || !characterId.equals(entry.getCharacterId()))) throw new ResourceNotFoundException("找不到資料或資料已移除");
        m.setUsageEntryId(entryId);
        m.setUsageOriginalEntryId(entryId);
        m.setUsageName(entry == null ? null : entry.getAdventureName());
        m.setUsageCode(entry == null ? null : entry.getAdventureCode());
    }
}
