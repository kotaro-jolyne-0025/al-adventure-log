package com.dndadvlog.backend.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final SessionBindingFilter sessionBindingFilter;
    private final RequestOriginFilter requestOriginFilter;
    private final NoStoreAuthFilter noStoreAuthFilter;

    @Value("${cors.allowed-origin:http://localhost:4200}")
    private String allowedOrigin;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) {
        try {
            return authenticationConfiguration.getAuthenticationManager();
        } catch (Exception e) {
            throw new IllegalStateException("無法初始化 AuthenticationManager", e);
        }
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, SignedCsrfTokenRepository csrfTokenRepository) {
        try {
            http
                    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                    .csrf(csrf -> csrf.csrfTokenRepository(csrfTokenRepository)
                            // Stateless JWT requests are not new logins; controllers rotate CSRF explicitly.
                            .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy())
                            .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                    .exceptionHandling(exceptions -> exceptions
                            .authenticationEntryPoint((request, response, authException) -> {
                                response.setContentType("application/json;charset=UTF-8");
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"尚未登入或 Token 已失效\"}");
                            })
                            .accessDeniedHandler((request, response, exception) -> {
                                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                                if (exception instanceof org.springframework.security.web.csrf.CsrfException) {
                                    response.setContentType("application/json;charset=UTF-8");
                                    response.getWriter().write("{\"code\":\"CSRF_INVALID\",\"message\":\"頁面驗證已過期，請重新提交；若持續失敗，請檢查網站更新\"}");
                                }
                            })
                    )
                    .authorizeHttpRequests(auth -> auth
                            .requestMatchers("/api/auth/**").permitAll()
                            .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                            .requestMatchers("/error").permitAll()
                            .anyRequest().authenticated()
                    )
                    .addFilterBefore(requestOriginFilter, CorsFilter.class)
                    .addFilterBefore(noStoreAuthFilter, RequestOriginFilter.class)
                    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                    .addFilterAfter(sessionBindingFilter, JwtAuthenticationFilter.class);

            return http.build();
        } catch (Exception e) {
            throw new IllegalStateException("無法構建 SecurityFilterChain", e);
        }
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> patterns = new java.util.ArrayList<>();
        if (allowedOrigin != null && !allowedOrigin.isBlank()) {
            for (String origin : allowedOrigin.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty() && !patterns.contains(trimmed)) {
                    patterns.add(trimmed);
                }
            }
        }

        configuration.setAllowedOrigins(patterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-Requested-With", "X-Expected-Updated-At", "X-XSRF-TOKEN", "X-Session-Id", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(List.of("Content-Disposition"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
