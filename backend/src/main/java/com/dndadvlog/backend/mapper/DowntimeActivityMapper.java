package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.DowntimeActivity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface DowntimeActivityMapper {

    List<DowntimeActivity> findByEntryIdOrderByCreatedAtAsc(@Param("entryId") UUID entryId);

    List<DowntimeActivity> findByEntryIds(@Param("entryIds") List<UUID> entryIds);

    DowntimeActivity findById(@Param("id") UUID id);

    void insert(DowntimeActivity activity);

    void update(DowntimeActivity activity);

    void deleteById(@Param("id") UUID id);
}
