package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.UserOAuthAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface UserOAuthAccountMapper {
    UserOAuthAccount findByProviderAndProviderUserId(@Param("provider") String provider, @Param("providerUserId") String providerUserId);

    List<UserOAuthAccount> findByUserId(@Param("userId") UUID userId);

    void insert(UserOAuthAccount oauthAccount);

    void deleteById(@Param("id") UUID id);
}
