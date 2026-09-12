package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.InventoryItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface InventoryItemMapper {

    List<InventoryItem> findByCharacterId(@Param("characterId") UUID characterId);

    List<InventoryItem> findByCharacterIdAndItemType(@Param("characterId") UUID characterId, @Param("itemType") String itemType);

    InventoryItem findById(@Param("id") UUID id);

    InventoryItem findByAdventureGainedItemId(@Param("gainedItemId") UUID gainedItemId);

    void insert(InventoryItem item);

    void update(InventoryItem item);

    void deleteById(@Param("id") UUID id);
}