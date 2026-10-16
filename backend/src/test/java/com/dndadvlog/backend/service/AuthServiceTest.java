package com.dndadvlog.backend.service;

import com.dndadvlog.backend.config.JwtTokenProvider;
import com.dndadvlog.backend.dto.auth.ResetPasswordRequest;
import com.dndadvlog.backend.dto.auth.ForgotPasswordRequest;
import com.dndadvlog.backend.entity.PasswordResetToken;
import com.dndadvlog.backend.entity.User;
import com.dndadvlog.backend.mapper.PasswordResetTokenMapper;
import com.dndadvlog.backend.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(OutputCaptureExtension.class)
class AuthServiceTest {
    @Test
    void successfulPasswordResetDoesNotLogPersonalEmailOrCredential(CapturedOutput output) {
        UserMapper users = mock(UserMapper.class);
        PasswordResetTokenMapper tokens = mock(PasswordResetTokenMapper.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AuthService service = new AuthService(users, tokens, mock(EmailService.class), encoder,
                mock(JwtTokenProvider.class), mock(OAuthService.class));
        UUID userId = UUID.randomUUID();
        UUID resetId = UUID.randomUUID();
        String email = "reset-player@example.invalid";
        String token = "synthetic-reset-credential";
        when(tokens.findByToken(token)).thenReturn(PasswordResetToken.builder()
                .id(resetId).userId(userId).token(token).expiryTime(LocalDateTime.now().plusMinutes(15)).build());
        when(users.findById(userId)).thenReturn(User.builder().id(userId).email(email).build());
        when(encoder.encode("synthetic-new-password")).thenReturn("synthetic-hash");
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(token);
        request.setNewPassword("synthetic-new-password");

        service.resetPassword(request);

        verify(users).updatePassword(userId, "synthetic-hash");
        verify(tokens).markAsUsed(eq(resetId), any(LocalDateTime.class));
        assertTrue(output.getOut().contains("密碼已成功重設"));
        assertFalse(output.getOut().contains(email));
        assertFalse(output.getOut().contains(token));
        assertFalse(output.getOut().contains(request.getNewPassword()));
    }

    @Test
    void googleBoundAccountDoesNotReceiveOrUseLocalPasswordReset(CapturedOutput output) {
        UserMapper users = mock(UserMapper.class);
        PasswordResetTokenMapper tokens = mock(PasswordResetTokenMapper.class);
        EmailService email = mock(EmailService.class);
        OAuthService oauth = mock(OAuthService.class);
        AuthService service = new AuthService(users, tokens, email, mock(PasswordEncoder.class),
                mock(JwtTokenProvider.class), oauth);
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("google-player@example.invalid").build();
        when(users.findByEmail(user.getEmail())).thenReturn(user);
        when(oauth.hasGoogleBinding(userId)).thenReturn(true);

        ForgotPasswordRequest forgot = new ForgotPasswordRequest();
        forgot.setEmail(user.getEmail());
        service.forgotPassword(forgot);
        verify(email, never()).sendPasswordResetEmail(anyString(), anyString(), anyInt());
        verify(tokens, never()).insert(any());

        String token = "synthetic-previously-issued-reset-proof";
        when(tokens.findByToken(token)).thenReturn(PasswordResetToken.builder().id(UUID.randomUUID())
                .userId(userId).token(token).expiryTime(LocalDateTime.now().plusMinutes(10)).build());
        ResetPasswordRequest reset = new ResetPasswordRequest();
        reset.setToken(token);
        reset.setNewPassword("synthetic-new-password");

        assertThrows(com.dndadvlog.backend.exception.BusinessException.class, () -> service.verifyResetToken(token));
        assertThrows(com.dndadvlog.backend.exception.BusinessException.class, () -> service.resetPassword(reset));
        verify(users, never()).updatePassword(eq(userId), any());
        verify(tokens, never()).markAsUsed(any(), any());
        assertFalse(output.getOut().contains(token));
    }
}
