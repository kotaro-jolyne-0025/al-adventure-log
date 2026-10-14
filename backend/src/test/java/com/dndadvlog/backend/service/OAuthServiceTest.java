package com.dndadvlog.backend.service;

import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.entity.UserOAuthAccount;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.*;

class OAuthServiceTest {
    private final UserMapper users = mock(UserMapper.class);
    private final UserOAuthAccountMapper accounts = mock(UserOAuthAccountMapper.class);
    private final OAuthService service = new OAuthService(users, accounts);

    @Test
    void validatesAudienceIssuerExpiryIdentityAndVerifiedEmail() {
        ReflectionTestUtils.setField(service, "googleClientId", "example-client");
        ObjectNode claims = new ObjectMapper().createObjectNode()
                .put("aud", "example-client").put("iss", "https://accounts.google.com")
                .put("exp", Instant.now().plusSeconds(300).getEpochSecond())
                .put("sub", "example-user").put("email", "player@example.invalid").put("email_verified", true);
        assertDoesNotThrow(() -> service.validateGoogleClaims(claims));
        for (String field : new String[]{"aud", "iss", "exp", "sub", "email", "email_verified"}) {
            ObjectNode invalid = claims.deepCopy();
            invalid.remove(field);
            assertThrows(BusinessException.class, () -> service.validateGoogleClaims(invalid), field);
        }
        assertThrows(BusinessException.class, () -> service.validateGoogleClaims(claims.deepCopy().put("aud", "another-client")));
        assertThrows(BusinessException.class, () -> service.validateGoogleClaims(claims.deepCopy().put("iss", "https://example.invalid")));
        assertThrows(BusinessException.class, () -> service.validateGoogleClaims(claims.deepCopy().put("exp", Instant.now().minusSeconds(1).getEpochSecond())));
        assertThrows(BusinessException.class, () -> service.validateGoogleClaims(claims.deepCopy().put("email_verified", false)));
        ReflectionTestUtils.setField(service, "googleClientId", "");
        assertThrows(BusinessException.class, () -> service.validateGoogleClaims(claims));
    }

    @Test
    void unboundProviderEmailCollisionDoesNotAutoLink() {
        User existing = User.builder().id(java.util.UUID.randomUUID()).email("player@example.invalid").isActive(true).build();
        when(users.findByEmail("player@example.invalid")).thenReturn(existing);

        BusinessException error = assertThrows(BusinessException.class, () ->
                ReflectionTestUtils.invokeMethod(service, "findAndSyncExistingUser",
                        new OAuthService.OAuthUserInfo("GOOGLE", "new-subject", existing.getEmail(), "Player", null, true)));

        assertTrue(error.getMessage().contains("尚未連結"));
        verify(accounts).findByProviderAndProviderUserId("GOOGLE", "new-subject");
        verify(accounts, never()).insert(any());
        verify(users, never()).insert(any());
    }

    @Test
    void boundGoogleAccountClearsExistingPassword() {
        var userId = java.util.UUID.randomUUID();
        UserOAuthAccount binding = UserOAuthAccount.builder().userId(userId).build();
        User existing = User.builder().id(userId).passwordHash("old-hash").isActive(true).build();
        when(accounts.findByProviderAndProviderUserId("GOOGLE", "subject")).thenReturn(binding);
        when(users.findById(userId)).thenReturn(existing);

        User result = ReflectionTestUtils.invokeMethod(service, "findAndSyncExistingUser",
                new OAuthService.OAuthUserInfo("GOOGLE", "subject", "verified@example.invalid", "Player", null, true));

        assertSame(existing, result);
        assertNull(result.getPasswordHash());
        verify(users).updatePassword(userId, null);
    }

    @Test
    void disabledBoundAccountCannotLogin() {
        var userId = java.util.UUID.randomUUID();
        UserOAuthAccount binding = UserOAuthAccount.builder().userId(userId).build();
        when(accounts.findByProviderAndProviderUserId("GOOGLE", "subject")).thenReturn(binding);
        when(users.findById(userId)).thenReturn(User.builder().id(userId).isActive(false).build());

        assertThrows(BusinessException.class, () -> ReflectionTestUtils.invokeMethod(service,
                "findAndSyncExistingUser", new OAuthService.OAuthUserInfo("GOOGLE", "subject", "a@example.invalid", "A", null, true)));
        verify(users, never()).updatePassword(any(), any());
    }

    @Test
    void rejectsUnverifiedProviderEmailButAllowsProviderIdentityWithoutEmail() {
        assertThrows(BusinessException.class, () -> service.validateProviderEmail("player@example.invalid", false));
        assertDoesNotThrow(() -> service.validateProviderEmail(null, false));
        assertDoesNotThrow(() -> service.validateProviderEmail("player@example.invalid", true));
    }
}
