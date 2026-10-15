package com.dndadvlog.backend.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {
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
