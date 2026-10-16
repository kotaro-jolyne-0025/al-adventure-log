package com.dndadvlog.backend.service;

import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.entity.UserOAuthAccount;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OAuthAccountService {
    private final UserMapper userMapper;
    private final UserOAuthAccountMapper oauthAccountMapper;

    @Transactional
    public User findAndSyncExistingUser(OAuthService.OAuthUserInfo userInfo) {
        UserOAuthAccount existingOAuth = oauthAccountMapper.findByProviderAndProviderUserId(
                userInfo.provider(), userInfo.providerUserId());
        if (existingOAuth != null) {
            User user = userMapper.findById(existingOAuth.getUserId());
            if (user == null || Boolean.FALSE.equals(user.getIsActive())) {
                throw new BusinessException("此帳號目前無法登入，請聯繫管理員");
            }
            if ("GOOGLE".equals(userInfo.provider()) && user.getPasswordHash() != null) {
                userMapper.updatePassword(user.getId(), null);
                user.setPasswordHash(null);
            }
            if (user.getAvatarUrl() == null && userInfo.avatarUrl() != null) {
                user.setAvatarUrl(userInfo.avatarUrl());
                userMapper.update(user);
            }
            return user;
        }

        if (userInfo.email() != null && !userInfo.email().isBlank()
                && userMapper.findByEmail(userInfo.email()) != null) {
            throw new BusinessException("此登入方式尚未連結，請先使用原本的登入方式");
        }
        return null;
    }
}
