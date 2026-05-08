package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;

    public WebConfig(KinEchoProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(false)
            .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new ApiTokenInterceptor(properties))
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/health", "/api/ai/audio/**");
        registry.addInterceptor(new FamilyScopeInterceptor(properties, mapper))
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/health", "/api/ai/audio/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/ai-voice/**")
            .addResourceLocations(properties.aiVoiceUploadDir.toUri().toString());
    }
}
