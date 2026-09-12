package com.dndadvlog.backend;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    // CORS 設定已統一由 SecurityConfig.corsConfigurationSource 接管，避免重複配置產生衝突
}
