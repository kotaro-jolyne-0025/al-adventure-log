package com.dndadvlog.backend.service;

import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.entity.UserOAuthAccount;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import com.dndadvlog.backend.config.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.dndadvlog.backend.dto.auth.OAuthLoginRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class OAuthServiceTest {
    private final UserMapper users = mock(UserMapper.class);
    private final UserOAuthAccountMapper accounts = mock(UserOAuthAccountMapper.class);
    private final JwtTokenProvider tokens = new JwtTokenProvider("synthetic-test-key-at-least-32-bytes-long", 3600000);
    private final OAuthService service = new OAuthService(users, accounts, tokens);

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
                        new OAuthService.OAuthUserInfo("GOOGLE", "new-subject", existing.getEmail(), null, true)));

        assertTrue(error.getMessage().contains("尚未連結"));
        verify(accounts).findByProviderAndProviderUserId("GOOGLE", "new-subject");
        verify(accounts, never()).insert(any());
        verify(users, never()).insert(any());
    }

    @Test
    void boundGoogleAccountClearsExistingPassword() {
        var userId = java.util.UUID.randomUUID();
        UserOAuthAccount binding = UserOAuthAccount.builder().userId(userId).build();
        User existing = User.builder().id(userId).displayName("本站暱稱").passwordHash("old-hash").isActive(true).build();
        when(accounts.findByProviderAndProviderUserId("GOOGLE", "subject")).thenReturn(binding);
        when(users.findById(userId)).thenReturn(existing);

        User result = ReflectionTestUtils.invokeMethod(service, "findAndSyncExistingUser",
                new OAuthService.OAuthUserInfo("GOOGLE", "subject", "verified@example.invalid", null, true));

        assertSame(existing, result);
        assertNull(result.getPasswordHash());
        assertEquals("本站暱稱", result.getDisplayName());
        verify(users).updatePassword(userId, null);
    }

    @Test
    void disabledBoundAccountCannotLogin() {
        var userId = java.util.UUID.randomUUID();
        UserOAuthAccount binding = UserOAuthAccount.builder().userId(userId).build();
        when(accounts.findByProviderAndProviderUserId("GOOGLE", "subject")).thenReturn(binding);
        when(users.findById(userId)).thenReturn(User.builder().id(userId).isActive(false).build());

        assertThrows(BusinessException.class, () -> ReflectionTestUtils.invokeMethod(service,
                "findAndSyncExistingUser", new OAuthService.OAuthUserInfo("GOOGLE", "subject", "a@example.invalid", null, true)));
        verify(users, never()).updatePassword(any(), any());
    }

    @Test
    void rejectsUnverifiedProviderEmailButAllowsProviderIdentityWithoutEmail() {
        assertThrows(BusinessException.class, () -> service.validateProviderEmail("player@example.invalid", false));
        assertDoesNotThrow(() -> service.validateProviderEmail(null, false));
        assertDoesNotThrow(() -> service.validateProviderEmail("player@example.invalid", true));
    }

    @Test
    void newGoogleIdentityWaitsForChosenNicknameWithoutImportingProviderName() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        ReflectionTestUtils.setField(service, "restClient", builder.build());
        ReflectionTestUtils.setField(service, "googleClientId", "example-client");
        server.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=google-fixture"))
                .andRespond(withSuccess("""
                        {"aud":"example-client","iss":"accounts.google.com","sub":"google-subject",
                        "email":"new@example.invalid","email_verified":true,"name":"Provider private name","exp":%d}
                        """.formatted(Instant.now().plusSeconds(300).getEpochSecond()), MediaType.APPLICATION_JSON));
        var request = new OAuthLoginRequest();
        request.setProvider("GOOGLE");
        request.setTokenOrCode("google-fixture");

        var result = service.processOAuthLogin(request);

        assertNull(result.user());
        assertFalse(tokens.getOAuthRegistrationClaims(result.registrationToken()).containsKey("displayName"));
        verify(users, never()).insert(any());
        verify(accounts, never()).insert(any());
        User created = service.completeRegistration(result.registrationToken(), "  自選暱稱  ");
        assertEquals("自選暱稱", created.getDisplayName());
        assertNull(created.getPasswordHash());
        verify(users).insert(created);
        verify(accounts).insert(argThat(binding -> binding.getUserId().equals(created.getId())));
        server.verify();
    }

    @Test
    void discordCodeIsExchangedOnceAndCompletionUsesOnlyRegistrationProof() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        ReflectionTestUtils.setField(service, "restClient", builder.build());
        ReflectionTestUtils.setField(service, "discordClientId", "test-client");
        ReflectionTestUtils.setField(service, "discordClientSecret", "synthetic-client-fixture");
        server.expect(requestTo("https://discord.com/api/v10/oauth2/token")).andExpect(method(HttpMethod.POST))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("code=single-use-fixture")))
                .andRespond(withSuccess("{\"access_token\":\"transient-fixture\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://discord.com/api/v10/users/@me"))
                .andExpect(header("Authorization", "Bearer transient-fixture"))
                .andRespond(withSuccess("{\"id\":\"discord-subject\",\"username\":\"Provider name\",\"verified\":false}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://discord.com/api/v10/oauth2/token/revoke")).andRespond(withSuccess());
        var request = new OAuthLoginRequest();
        request.setProvider("DISCORD");
        request.setTokenOrCode("single-use-fixture");
        request.setRedirectUri("https://example.invalid/auth/callback/discord");

        var result = service.processOAuthLogin(request);
        assertNull(result.user());
        User created = service.completeRegistration(result.registrationToken(), "Discord 自選暱稱");
        assertEquals("Discord 自選暱稱", created.getDisplayName());
        assertEquals("discord_discord-subject@dndadvlog.internal", created.getEmail());
        server.verify();
    }

    @Test
    void confirmationRechecksBindingAndEmailWithoutChangingExistingName() {
        String proof = tokens.generateOAuthRegistrationToken("DISCORD", "subject", "player@example.invalid", null);
        when(accounts.findByProviderAndProviderUserId("DISCORD", "subject"))
                .thenReturn(UserOAuthAccount.builder().userId(java.util.UUID.randomUUID()).build());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.completeRegistration(proof, "Another name")).getStatusCode().value());
        verify(users, never()).insert(any());
        verify(users, never()).update(any());
        reset(accounts);
        when(users.findByEmail("player@example.invalid")).thenReturn(User.builder().build());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.completeRegistration(proof, "Another name")).getStatusCode().value());
        verify(accounts, never()).insert(any());
    }

    @Test
    void invalidExpiredOrLoginTokensCannotCreateAccounts() {
        var key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                "synthetic-test-key-at-least-32-bytes-long".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String expired = io.jsonwebtoken.Jwts.builder().subject("subject").claim("purpose", "oauth-registration")
                .expiration(java.util.Date.from(Instant.now().minusSeconds(10))).signWith(key).compact();
        String access = tokens.generateToken(java.util.UUID.randomUUID(), "a@example.invalid", "Player", null);
        for (String invalid : new String[]{"tampered", expired, access}) {
            var error = assertThrows(ResponseStatusException.class, () -> service.completeRegistration(invalid, "暱稱"));
            assertEquals(410, error.getStatusCode().value());
            assertFalse(error.getReason().contains(invalid));
        }
        verifyNoInteractions(users, accounts);
    }
}
