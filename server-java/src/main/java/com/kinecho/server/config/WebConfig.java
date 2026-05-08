package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.mapper.KinEchoMapper;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;
    private final KinEchoMapper db;

    public WebConfig(KinEchoProperties properties, ObjectMapper mapper, KinEchoMapper db) {
        this.properties = properties;
        this.mapper = mapper;
        this.db = db;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> allowedOrigins = properties.corsAllowedOrigins.stream()
            .filter(origin -> origin != null && !origin.isBlank())
            .toList();
        registry.addMapping("/**")
            .allowedOriginPatterns(allowedOrigins.toArray(String[]::new))
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(false)
            .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new ApiTokenInterceptor(properties, mapper))
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/health", "/api/ai/audio/**", "/api/ai/voice-upload/**");
        registry.addInterceptor(new AdminRoleInterceptor(properties, mapper, db))
            .addPathPatterns("/api/admin/**");
        registry.addInterceptor(new FamilyScopeInterceptor(properties, mapper))
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/health", "/api/ai/audio/**", "/api/ai/voice-upload/**");
    }
}
