package com.dndadvlog.backend.service;

import com.dndadvlog.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import java.util.function.Supplier;

/** All HTTP mutations acquire the character lock before changing any owned resource. */
@Service
@RequiredArgsConstructor
public class MutationGuard {
    public enum Resource { CHARACTER, ENTRY, ITEM, ACTIVITY, GAINED_ITEM, STORY_AWARD }
    private record Target(String table, UUID id, UUID characterId) {}
    private final JdbcTemplate jdbc;
    private static final String NEXT_TIME =
            "GREATEST(clock_timestamp()::timestamp, updated_at + INTERVAL '1 microsecond')";

    @Transactional
    public <T> T mutate(Resource resource, UUID id, UUID userId, String expected, Supplier<T> write) {
        LocalDateTime timestamp = parseExpected(expected);
        Target before = resolve(resource, id, userId);
        lockCharacter(before.characterId(), userId);
        Target target = resolve(resource, id, userId);
        if (!target.characterId().equals(before.characterId())) throw conflict();
        int changed = jdbc.update("UPDATE " + target.table() + " SET updated_at = " + NEXT_TIME
                        + " WHERE id = ? AND updated_at = ?", target.id(), Timestamp.valueOf(timestamp));
        if (changed != 1) throw conflict();
        if (resource != Resource.CHARACTER) touch("\"character\"", target.characterId());
        if (resource == Resource.CHARACTER || resource == Resource.ENTRY || resource == Resource.ITEM || resource == Resource.GAINED_ITEM) {
            touchLegacyEntries(target.characterId());
        }
        if (resource == Resource.ITEM) {
            jdbc.update("UPDATE adventure_entry SET updated_at = " + NEXT_TIME
                    + " WHERE character_id = ? AND id = (SELECT adventure_entry_id FROM inventory_item WHERE id = ?)",
                    target.characterId(), id);
        }
        T result = write.get();
        if (resource == Resource.ITEM) {
            // A warehouse edit may also change its source association; invalidate both parents.
            jdbc.update("UPDATE adventure_entry SET updated_at = " + NEXT_TIME
                    + " WHERE character_id = ? AND id = (SELECT adventure_entry_id FROM inventory_item WHERE id = ?)",
                    target.characterId(), id);
        }
        return result;
    }

    /** Adding an independent item has no stale content to replace, but its totals must serialize. */
    @Transactional
    public <T> T createItem(UUID characterId, UUID userId, Supplier<T> write) {
        lockCharacter(characterId, userId);
        touch("\"character\"", characterId);
        touchLegacyEntries(characterId);
        return write.get();
    }

    private void lockCharacter(UUID id, UUID userId) {
        if (jdbc.query("SELECT id FROM \"character\" WHERE id = ? AND user_id = ? FOR UPDATE",
                (row, n) -> row.getObject("id", UUID.class), id, userId).isEmpty()) {
            throw new ResourceNotFoundException("找不到角色或資料已移除");
        }
    }

    private Target resolve(Resource resource, UUID id, UUID userId) {
        String source = switch (resource) {
            case CHARACTER -> "\"character\"";
            case ENTRY -> "adventure_entry";
            case ITEM -> "inventory_item";
            case ACTIVITY -> "downtime_activity";
            case GAINED_ITEM -> "adventure_gained_item";
            case STORY_AWARD -> "adventure_story_award";
        };
        boolean child = resource == Resource.ACTIVITY || resource == Resource.GAINED_ITEM || resource == Resource.STORY_AWARD;
        String sql = resource == Resource.CHARACTER
                ? "SELECT c.id AS target_id, c.id AS character_id FROM \"character\" c WHERE c.id = ? AND c.user_id = ?"
                : "SELECT " + (child ? "e.id" : "r.id") + " AS target_id, c.id AS character_id FROM " + source + " r "
                  + (child ? "JOIN adventure_entry e ON e.id = r.adventure_entry_id JOIN \"character\" c ON c.id = e.character_id "
                           : "JOIN \"character\" c ON c.id = r.character_id ")
                  + "WHERE r.id = ? AND c.user_id = ?";
        return jdbc.query(sql, (row, n) -> new Target(child ? "adventure_entry" : source,
                row.getObject("target_id", UUID.class), row.getObject("character_id", UUID.class)), id, userId)
                .stream().findFirst().orElseThrow(() -> new ResourceNotFoundException("找不到資料或資料已移除"));
    }

    private void touch(String table, UUID id) {
        jdbc.update("UPDATE " + table + " SET updated_at = " + NEXT_TIME + " WHERE id = ?", id);
    }

    private void touchLegacyEntries(UUID characterId) {
        // Empty snapshots read legacy warehouse data; warehouse changes invalidate that baseline.
        jdbc.update("UPDATE adventure_entry e SET updated_at = " + NEXT_TIME
                + " WHERE e.character_id = ? AND NOT EXISTS (SELECT 1 FROM adventure_gained_item g WHERE g.adventure_entry_id = e.id)", characterId);
    }

    private LocalDateTime parseExpected(String expected) {
        if (expected == null || expected.isBlank()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED, "缺少資料更新時間，請更新網頁並重新讀取資料。輸入尚未儲存。");
        }
        try {
            LocalDateTime value = LocalDateTime.parse(expected);
            if (value.getNano() % 1000 != 0) throw new DateTimeParseException("Unsupported precision", expected, 0);
            return value;
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "資料更新時間格式不正確，請重新讀取資料。", ex);
        }
    }

    private ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "資料已在其他視窗或裝置更新。你的輸入尚未儲存且仍保留，請查看新版後再決定如何修改。");
    }
}
