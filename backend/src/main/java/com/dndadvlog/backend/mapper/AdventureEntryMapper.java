package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.AdventureEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Mapper
public interface AdventureEntryMapper {

    List<AdventureEntry> findByCharacterIdOrderByPlayDateAsc(@Param("characterId") UUID characterId);

    AdventureEntry findById(@Param("id") UUID id);

    AdventureEntry findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    Optional<AdventureEntry> findFirstByCharacterIdOrderByPlayDateDescCreatedAtDesc(@Param("characterId") UUID characterId);

    void insert(AdventureEntry entry);

    void update(AdventureEntry entry);

    void deleteById(@Param("id") UUID id);

}
