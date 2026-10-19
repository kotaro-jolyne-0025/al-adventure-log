package com.dndadvlog.backend.config;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RequestOriginFilter extends OncePerRequestFilter {
    private final Set<String> allowedOrigins;

    public RequestOriginFilter(@Value("${cors.allowed-origin:http://localhost:4200}") String configured) {
        allowedOrigins = Arrays.stream(configured.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!Set.of("GET", "HEAD", "OPTIONS", "TRACE").contains(request.getMethod())) {
            String origin = request.getHeader("Origin");
            if (origin != null && !allowedOrigins.contains(origin)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":\"CSRF_INVALID\",\"message\":\"請求來源無效\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
