package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.dto.InventoryMovementResponse;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Mapper
public interface InventoryMovementMapper {
    String SELECT = """
        SELECT m.*, EXISTS(SELECT 1 FROM inventory_movement r WHERE r.reversal_of=m.id) AS reversed,
          (m.operation='CONSUME'
           AND EXISTS(SELECT 1 FROM inventory_item i WHERE i.id=m.item_id AND i.character_id=m.character_id AND i.item_type='CONSUMABLE' AND i.quantity=m.quantity_after)
           AND NOT EXISTS(SELECT 1 FROM inventory_movement n WHERE n.item_id=m.item_id AND n.created_at>m.created_at)) AS reversible
        FROM inventory_movement m
        """;

    @Select(SELECT + " WHERE m.id=#{id}")
    InventoryMovementResponse findById(UUID id);

    @Select("<script>" + SELECT + " WHERE m.character_id=#{characterId}"
        + "<if test='usageAdventureEntryId == null'> AND m.operation NOT IN ('BASELINE','REVERSE')"
        + " AND NOT EXISTS(SELECT 1 FROM inventory_movement r WHERE r.reversal_of=m.id)</if>"
        + "<if test='usageAdventureEntryId != null'> AND m.operation='CONSUME' AND m.usage_entry_id=#{usageAdventureEntryId}"
        + " AND EXISTS(SELECT 1 FROM inventory_movement r WHERE r.reversal_of=m.id)=#{reversed}</if>"
        + "<if test='time != null'> AND (m.created_at,m.id) &lt; (#{time},#{id})</if>"
        + " ORDER BY m.created_at DESC,m.id DESC LIMIT #{limit}</script>")
    List<InventoryMovementResponse> page(@Param("characterId") UUID characterId,
        @Param("time") LocalDateTime time, @Param("id") UUID id, @Param("limit") int limit,
        @Param("usageAdventureEntryId") UUID usageAdventureEntryId, @Param("reversed") Boolean reversed);

    @Insert("""
        INSERT INTO inventory_movement(id,character_id,item_id,item_name,item_type,previous_item_type,
          operation,reason,quantity_before,quantity_delta,quantity_after,source_entry_id,source_gained_item_id,
          source_name,source_code,usage_entry_id,usage_original_entry_id,usage_name,usage_code,notes,reversal_of,created_at)
        SELECT #{id},#{characterId},#{itemId},#{itemName},#{itemType},#{previousItemType},
          #{operation},#{reason},#{quantityBefore},#{quantityDelta},#{quantityAfter},#{sourceEntryId},#{sourceGainedItemId},
          #{sourceName},#{sourceCode},#{usageEntryId},#{usageOriginalEntryId},#{usageName},#{usageCode},#{notes},#{reversalOf},
          GREATEST(clock_timestamp()::timestamp, COALESCE((SELECT MAX(created_at)+INTERVAL '1 microsecond'
            FROM inventory_movement WHERE item_id=#{itemId}),clock_timestamp()::timestamp))
        """)
    void insert(InventoryMovementResponse movement);

    @Update("""
        UPDATE inventory_movement SET usage_entry_id=#{usageEntryId},usage_original_entry_id=#{usageOriginalEntryId},
            usage_name=#{usageName},usage_code=#{usageCode},notes=#{notes}
        WHERE id=#{id}
        """)
    void updateUsage(InventoryMovementResponse movement);
}
