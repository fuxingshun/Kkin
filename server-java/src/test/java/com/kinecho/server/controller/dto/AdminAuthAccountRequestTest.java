package com.kinecho.server.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminAuthAccountRequestTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestValidatesRoleAndPassword() {
        AdminAuthAccountCreateRequest request = new AdminAuthAccountCreateRequest(
            "guest",
            "ops",
            "short",
            "Ops",
            List.of("admin:auth"),
            0L,
            "org_1",
            "family_001",
            false,
            "admin"
        );

        var violations = validator.validate(request);

        assertEquals(2, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("role")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("password")));
    }

    @Test
    void createRequestKeepsSnakeCaseServiceKeys() {
        AdminAuthAccountCreateRequest request = new AdminAuthAccountCreateRequest(
            "family",
            "daughter",
            "family-strong-password",
            "family daughter",
            List.of("family:read"),
            9L,
            "org_1",
            "family_001",
            false,
            "admin"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family daughter", data.get("display_name"));
        assertEquals(9L, data.get("user_id"));
        assertEquals("org_1", data.get("organization_id"));
        assertEquals("family_001", data.get("family_id"));
    }

    @Test
    void updateRequestOnlySendsPresentFields() {
        AdminAuthAccountUpdateRequest request = new AdminAuthAccountUpdateRequest(
            null,
            "new-strong-password",
            null,
            null,
            null,
            null,
            null,
            true,
            true,
            null,
            null,
            "security-admin"
        );

        Map<String, Object> data = request.toMap();

        assertFalse(data.containsKey("display_name"));
        assertEquals("new-strong-password", data.get("password"));
        assertEquals(true, data.get("unlock"));
        assertEquals(true, data.get("confirmed"));
        assertEquals("security-admin", data.get("operator"));
    }

    @Test
    void createRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(AdminAuthAccountCreateRequest.class.getAnnotation(Schema.class));
        Schema role = recordComponent(AdminAuthAccountCreateRequest.class, "role").getAccessor().getAnnotation(Schema.class);
        assertEquals("family", role.example());
        assertTrue(List.of(role.allowableValues()).contains("elderly"));
    }

    private static RecordComponent recordComponent(Class<?> type, String name) {
        for (RecordComponent component : type.getRecordComponents()) {
            if (component.getName().equals(name)) {
                return component;
            }
        }
        throw new AssertionError("missing record component " + name);
    }
}
