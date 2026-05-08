package com.kinecho.server.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class StartupSafetyValidator {
    private final KinEchoProperties properties;
    private final Environment environment;

    public StartupSafetyValidator(KinEchoProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @PostConstruct
    void validate() {
        if (!isProductionProfile()) {
            return;
        }

        List<String> errors = new ArrayList<>();
        if (!properties.apiTokenEnabled) {
            errors.add("KINECHO_API_TOKEN_ENABLED must be true");
        }
        if (weakSecret(properties.apiToken)) {
            errors.add("KINECHO_API_TOKEN must be set to a strong non-default value");
        }
        if (!properties.familyScopeSessionRequired) {
            errors.add("KINECHO_FAMILY_SCOPE_SESSION_REQUIRED must be true");
        }
        if (properties.phoneSuffixLoginEnabled) {
            errors.add("KINECHO_PHONE_SUFFIX_LOGIN_ENABLED must be false");
        }
        if (!blank(properties.demoLoginPassword)) {
            errors.add("KINECHO_DEMO_LOGIN_PASSWORD must be empty in production");
        }
        if (properties.staticOperatorLoginEnabled) {
            errors.add("KINECHO_STATIC_OPERATOR_LOGIN_ENABLED must be false");
        }
        if (weakSecret(properties.sessionSigningKey)) {
            errors.add("KINECHO_SESSION_SIGNING_KEY must be set to a strong non-default value");
        }
        if (weakCredential(properties.adminPassword, "admin")) {
            errors.add("KINECHO_ADMIN_PASSWORD must not use a default or weak value");
        }
        if (weakCredential(properties.servicePassword, "service")) {
            errors.add("KINECHO_SERVICE_PASSWORD must not use a default or weak value");
        }
        if (unsafeCors(properties.corsAllowedOrigins)) {
            errors.add("KINECHO_CORS_ALLOWED_ORIGINS must list explicit trusted origins");
        }
        if (properties.psychologyVideoAllowedHosts == null || properties.psychologyVideoAllowedHosts.isEmpty()) {
            errors.add("KINECHO_PSYCHOLOGY_VIDEO_ALLOWED_HOSTS must list trusted video source hosts");
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Unsafe production configuration: " + String.join("; ", errors));
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
            .map(profile -> profile.toLowerCase(Locale.ROOT))
            .anyMatch(profile -> profile.equals("prod") || profile.equals("production"));
    }

    private static boolean unsafeCors(List<String> origins) {
        if (origins == null || origins.isEmpty()) {
            return true;
        }
        return origins.stream().anyMatch(origin -> {
            String value = origin == null ? "" : origin.trim();
            return value.isBlank()
                || "*".equals(value)
                || value.contains("://*")
                || value.equalsIgnoreCase("http://localhost:*")
                || value.equalsIgnoreCase("http://127.0.0.1:*");
        });
    }

    private static boolean weakCredential(String value, String username) {
        if (weakSecret(value)) {
            return true;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.equals(username)
            || normalized.equals(username + "123")
            || normalized.equals(username + "123456")
            || normalized.equals("password")
            || normalized.equals("123456");
    }

    private static boolean weakSecret(String value) {
        if (blank(value) || value.trim().length() < 32) {
            return true;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("change-me")
            || normalized.contains("changeme")
            || normalized.contains("secret")
            || normalized.contains("default")
            || normalized.contains("dev")
            || normalized.contains("test")
            || normalized.contains("123456");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
