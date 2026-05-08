package com.kinecho.server.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StartupSafetyValidatorTest {
    @Test
    void rejectsUnsafeProductionDefaults() {
        KinEchoProperties properties = new KinEchoProperties();
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        StartupSafetyValidator validator = new StartupSafetyValidator(properties, environment);

        assertThrows(IllegalStateException.class, validator::validate);
    }

    @Test
    void allowsHardenedProductionConfig() {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setApiTokenEnabled(true);
        properties.setApiToken("prod-api-token-with-at-least-32-chars");
        properties.setSessionSigningKey("prod-session-key-with-at-least-32-chars");
        properties.setFamilyScopeSessionRequired(true);
        properties.setPhoneSuffixLoginEnabled(false);
        properties.setDemoLoginPassword("");
        properties.setStaticOperatorLoginEnabled(false);
        properties.setAdminPassword("admin-prod-password-with-32-chars");
        properties.setServicePassword("service-prod-password-with-32-chars");
        properties.setCorsAllowedOrigins(List.of("https://admin.example.com", "https://miniapp.example.com"));
        properties.setPsychologyVideoAllowedHosts(List.of("media.example.com"));
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("production");

        StartupSafetyValidator validator = new StartupSafetyValidator(properties, environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    void rejectsWildcardProductionCors() {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setApiTokenEnabled(true);
        properties.setApiToken("prod-api-token-with-at-least-32-chars");
        properties.setSessionSigningKey("prod-session-key-with-at-least-32-chars");
        properties.setFamilyScopeSessionRequired(true);
        properties.setPhoneSuffixLoginEnabled(false);
        properties.setDemoLoginPassword("");
        properties.setStaticOperatorLoginEnabled(false);
        properties.setAdminPassword("admin-prod-password-with-32-chars");
        properties.setServicePassword("service-prod-password-with-32-chars");
        properties.setCorsAllowedOrigins(List.of("*"));
        properties.setPsychologyVideoAllowedHosts(List.of("media.example.com"));
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        StartupSafetyValidator validator = new StartupSafetyValidator(properties, environment);

        assertThrows(IllegalStateException.class, validator::validate);
    }
}
