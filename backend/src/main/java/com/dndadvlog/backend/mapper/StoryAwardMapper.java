package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.StoryAward;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface StoryAwardMapper {

    List<StoryAward> findByAdventureEntryId(@Param("adventureEntryId") UUID adventureEntryId);

    StoryAward findById(@Param("id") UUID id);

    void insert(StoryAward award);

    void update(StoryAward award);

    void deleteById(@Param("id") UUID id);

    void deleteByAdventureEntryId(@Param("adventureEntryId") UUID adventureEntryId);
}
