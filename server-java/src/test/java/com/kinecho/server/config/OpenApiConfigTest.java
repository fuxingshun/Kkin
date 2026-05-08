package com.kinecho.server.config;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;
import org.springdoc.core.models.GroupedOpenApi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpenApiConfigTest {
    private final OpenApiConfig config = new OpenApiConfig();

    @Test
    void openApiMetadataIncludesSecuritySchemes() {
        OpenAPI openAPI = config.kinEchoOpenApi();

        assertEquals("KinEcho API", openAPI.getInfo().getTitle());
        assertTrue(openAPI.getComponents().getSecuritySchemes().containsKey("apiToken"));
        assertTrue(openAPI.getComponents().getSecuritySchemes().containsKey("sessionToken"));
        assertEquals("X-KinEcho-Token", openAPI.getComponents().getSecuritySchemes().get("apiToken").getName());
    }

    @Test
    void openApiGroupsSeparateMainSurfaces() {
        GroupedOpenApi admin = config.adminApi();
        GroupedOpenApi service = config.serviceApi();
        GroupedOpenApi miniapp = config.miniappApi();

        assertEquals("admin-api", admin.getGroup());
        assertEquals("service-api", service.getGroup());
        assertEquals("miniapp-api", miniapp.getGroup());
        assertNotNull(miniapp.getPathsToMatch());
        assertTrue(miniapp.getPathsToMatch().contains("/api/privacy/**"));
    }
}
