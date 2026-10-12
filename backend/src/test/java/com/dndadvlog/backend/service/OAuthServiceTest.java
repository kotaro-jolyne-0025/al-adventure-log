package com.dndadvlog.backend.service;

import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.mapper.UserMapper;
import com.dndadvlog.backend.mapper.UserOAuthAccountMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class OAuthServiceTest {
    @Test
    void validatesAudienceIssuerExpiryIdentityAndVerifiedEmail() {
        OAuthService service = new OAuthService(mock(UserMapper.class), mock(UserOAuthAccountMapper.class));
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
}
