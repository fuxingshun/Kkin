package com.kinecho.server.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI kinEchoOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("KinEcho API")
                .version("1.0.0")
                .description("KinEcho miniapp, admin, service, privacy and AI companion API contract."))
            .components(new Components()
                .addSecuritySchemes("apiToken", new SecurityScheme()
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER)
                    .name("X-KinEcho-Token")
                    .description("Deployment API token. Also accepted as Authorization: Bearer <token>."))
                .addSecuritySchemes("sessionToken", new SecurityScheme()
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER)
                    .name("X-KinEcho-Session")
                    .description("Signed KinEcho session token returned by /api/auth/login.")))
            .addSecurityItem(new SecurityRequirement().addList("apiToken"));
    }

    @Bean
    public GroupedOpenApi adminApi() {
        return GroupedOpenApi.builder()
            .group("admin-api")
            .displayName("Admin API")
            .pathsToMatch("/api/admin/**")
            .build();
    }

    @Bean
    public GroupedOpenApi serviceApi() {
        return GroupedOpenApi.builder()
            .group("service-api")
            .displayName("Service API")
            .pathsToMatch("/api/service/**")
            .build();
    }

    @Bean
    public GroupedOpenApi miniappApi() {
        return GroupedOpenApi.builder()
            .group("miniapp-api")
            .displayName("Miniapp API")
            .pathsToMatch(
                "/api/auth/**",
                "/api/me",
                "/api/family/**",
                "/api/elderly/**",
                "/api/privacy/**",
                "/api/care/**",
                "/api/ai/**",
                "/api/psychology/**",
                "/api/psychology-videos/**",
                "/api/consultations/**"
            )
            .build();
    }
}
