package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.AdventureGainedItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface AdventureGainedItemMapper {

    List<AdventureGainedItem> findByAdventureEntryId(@Param("adventureEntryId") UUID adventureEntryId);

    AdventureGainedItem findById(@Param("id") UUID id);

    void insert(AdventureGainedItem item);

    void update(AdventureGainedItem item);

    void deleteById(@Param("id") UUID id);

    void deleteByAdventureEntryId(@Param("adventureEntryId") UUID adventureEntryId);
}
