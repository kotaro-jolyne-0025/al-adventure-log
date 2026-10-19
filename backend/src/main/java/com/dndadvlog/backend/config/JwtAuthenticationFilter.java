package com.dndadvlog.backend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.UnsupportedJwtException;
import com.dndadvlog.backend.mapper.UserMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserMapper userMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                Claims claims = tokenProvider.getClaimsFromJWT(jwt);
                UUID userId = UUID.fromString(claims.getSubject());
                // Missing versions belong to pre-migration access tokens and only match version 0.
                Long version = claims.containsKey("tokenVersion") ? claims.get("tokenVersion", Long.class) : 0L;
                if (version == null || version < 0 || !userMapper.isAccessTokenCurrent(userId, version)) {
                    throw new UnsupportedJwtException("登入憑證已失效");
                }
                String email = claims.get("email", String.class);
                String displayName = claims.get("displayName", String.class);
                String avatarUrl = claims.get("avatarUrl", String.class);

                UserPrincipal principal = UserPrincipal.builder()
                        .id(userId)
                        .email(email)
                        .displayName(displayName)
                        .avatarUrl(avatarUrl)
                        .build();

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (DataAccessException ex) {
            log.warn("暫時無法查核登入狀態");
            SecurityContextHolder.clearContext();
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "暫時無法驗證登入，請稍後再試");
            return;
        } catch (Exception ex) {
            log.warn("無法在 SecurityContext 中設定使用者認證資訊: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
