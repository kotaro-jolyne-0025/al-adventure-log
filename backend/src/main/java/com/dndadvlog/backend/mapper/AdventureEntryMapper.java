package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.AdventureEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Mapper
public interface AdventureEntryMapper {

    List<AdventureEntry> findByCharacterIdOrderByPlayDateAsc(@Param("characterId") UUID characterId);

    boolean existsByCharacterId(@Param("characterId") UUID characterId);

    AdventureEntry findById(@Param("id") UUID id);

    AdventureEntry findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    Optional<AdventureEntry> findFirstByCharacterIdOrderByPlayDateDescCreatedAtDesc(@Param("characterId") UUID characterId);

    AdventureEntry findPreviousForNew(
            @Param("characterId") UUID characterId,
            @Param("playDate") LocalDate playDate);

    AdventureEntry findPreviousForExisting(
            @Param("characterId") UUID characterId,
            @Param("playDate") LocalDate playDate,
            @Param("createdAt") LocalDateTime createdAt,
            @Param("id") UUID id);

    AdventureEntry findNextForExisting(
            @Param("characterId") UUID characterId,
            @Param("playDate") LocalDate playDate,
            @Param("createdAt") LocalDateTime createdAt,
            @Param("id") UUID id);

    void insert(AdventureEntry entry);

    void update(AdventureEntry entry);

    void deleteById(@Param("id") UUID id);

}
