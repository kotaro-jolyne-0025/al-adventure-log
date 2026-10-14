package com.dndadvlog.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(OutputCaptureExtension.class)
class EmailServiceTest {
    @Test
    void missingMailConfigurationNeverLogsAddressOrResetCredential(CapturedOutput output) {
        EmailService service = new EmailService();
        ReflectionTestUtils.setField(service, "mailHost", "");
        String privateEmail = "private-player@example.invalid";
        String resetToken = "synthetic-secret-reset-token";

        service.sendPasswordResetEmail(privateEmail, resetToken, 15);

        assertTrue(output.getOut().contains("SMTP 尚未設定"));
        assertFalse(output.getOut().contains(privateEmail));
        assertFalse(output.getOut().contains(resetToken));
        assertFalse(output.getOut().contains("reset-password?token="));
    }
}
