package com.dndadvlog.backend.config;

import java.io.IOException;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class SessionBindingFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Object principalValue = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        boolean profileUpdate = "PUT".equals(request.getMethod()) && "/api/auth/me".equals(request.getRequestURI());
        boolean renewal = "POST".equals(request.getMethod()) && "/api/auth/renew".equals(request.getRequestURI());
        boolean businessRequest = request.getRequestURI().startsWith("/api/") && !request.getRequestURI().startsWith("/api/auth/");
        if (principalValue instanceof UserPrincipal principal
                && (businessRequest || profileUpdate || renewal)) {
            String requestedSession = request.getHeader("X-Session-Id");
            if (!principal.getSessionId().equals(requestedSession)) {
                response.setStatus(HttpServletResponse.SC_CONFLICT);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":\"AUTH_SESSION_CHANGED\",\"message\":\"登入狀態已變更，請重新確認\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
