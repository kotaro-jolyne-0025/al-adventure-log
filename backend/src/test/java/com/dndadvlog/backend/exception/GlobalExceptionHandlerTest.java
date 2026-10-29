package com.dndadvlog.backend.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpMethod;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {
    @Test
    void unsupportedMethodPreservesAllowAndOmitsSensitiveValues(CapturedOutput output) {
        String sensitive = "synthetic-sensitive-request-value";
        var request = new MockHttpServletRequest("GET", "/api/auth/login");
        request.setQueryString("token=" + sensitive);
        request.setContent(sensitive.getBytes(StandardCharsets.UTF_8));
        var error = new HttpRequestMethodNotSupportedException("GET", Set.of("POST", "PUT"));

        var response = new GlobalExceptionHandler().handleUnsupportedMethod(error, request);

        assertEquals(405, response.getStatusCode().value());
        assertEquals(Set.of(HttpMethod.POST, HttpMethod.PUT), response.getHeaders().getAllow());
        var body = response.getBody();
        assertNotNull(body);
        assertEquals(Set.of("timestamp", "status", "error", "message", "path"), body.keySet());
        assertNotNull(body.get("timestamp"));
        assertEquals(405, body.get("status"));
        assertEquals("Method Not Allowed", body.get("error"));
        assertEquals("此 HTTP 方法不受支援", body.get("message"));
        assertEquals("/api/auth/login", body.get("path"));
        assertFalse(body.toString().contains(sensitive));
        assertFalse(output.getAll().contains(sensitive));
        assertFalse(output.getAll().contains("ERROR"));
        assertFalse(output.getAll().contains("HttpRequestMethodNotSupportedException"));
    }

    @Test
    void unexpectedFailureRemainsInternalServerError(CapturedOutput output) {
        var response = new GlobalExceptionHandler().handleGeneral(new IllegalStateException("synthetic failure"),
                new MockHttpServletRequest("POST", "/api/auth/login"));

        assertEquals(500, response.getStatusCode().value());
        assertEquals(500, response.getBody().get("status"));
        assertEquals("伺服器內部發生錯誤，請稍後再試", response.getBody().get("message"));
        assertTrue(output.getAll().contains("ERROR"));
        assertTrue(output.getAll().contains("IllegalStateException: synthetic failure"));
    }

    @Test
    void malformedAuthBodyDoesNotExposeRequestValuesInLogsOrResponse(CapturedOutput output) {
        String proof = "synthetic-sensitive-registration-proof";
        var error = new HttpMessageNotReadableException("Cannot parse value: " + proof, new MockHttpInputMessage(new byte[0]));
        var response = new GlobalExceptionHandler().handleUnreadableMessage(error,
                new MockHttpServletRequest("POST", "/api/auth/oauth/register"));
        assertEquals(400, response.getStatusCode().value());
        assertFalse(output.getAll().contains(proof));
        assertFalse(response.getBody().toString().contains(proof));
    }
}
