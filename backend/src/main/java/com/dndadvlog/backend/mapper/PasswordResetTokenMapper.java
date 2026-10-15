package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.PasswordResetToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.UUID;

@Mapper
public interface PasswordResetTokenMapper {
    PasswordResetToken findByToken(@Param("token") String token);

    void insert(PasswordResetToken token);

    void markAsUsed(@Param("id") UUID id, @Param("usedAt") LocalDateTime usedAt);

    void invalidateAllForUser(@Param("userId") UUID userId, @Param("now") LocalDateTime now);
}
