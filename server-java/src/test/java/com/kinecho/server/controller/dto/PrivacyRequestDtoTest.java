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

class PrivacyRequestDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestRequiresSupportedTypeAndFamily() {
        PrivacyRequestCreateRequest request = new PrivacyRequestCreateRequest(
            "",
            0L,
            "erase",
            "daughter",
            "pilot exit",
            Map.of()
        );

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("requestType")));
    }

    @Test
    void createRequestKeepsPrivacyServiceKeys() {
        PrivacyRequestCreateRequest request = new PrivacyRequestCreateRequest(
            "family_001",
            7L,
            "delete",
            "daughter",
            "pilot exit",
            Map.of("source", "miniapp")
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals("delete", data.get("request_type"));
        assertEquals("daughter", data.get("requested_by"));
        assertTrue(data.containsKey("metadata"));
    }

    @Test
    void reviewRequestKeepsProcessNoteFallbackFields() {
        PrivacyRequestReviewRequest request = new PrivacyRequestReviewRequest(
            "rejected",
            "privacy-admin",
            null,
            "not enough context"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("rejected", data.get("status"));
        assertEquals("privacy-admin", data.get("reviewer"));
        assertFalse(data.containsKey("process_note"));
        assertEquals("not enough context", data.get("reason"));
    }

    @Test
    void privacyDtosExposeOpenApiSchemaMetadata() {
        assertNotNull(PrivacyRequestCreateRequest.class.getAnnotation(Schema.class));
        Schema requestType = recordComponent(PrivacyRequestCreateRequest.class, "requestType").getAccessor().getAnnotation(Schema.class);
        assertEquals("delete", requestType.example());
        assertTrue(List.of(requestType.allowableValues()).contains("correction"));
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
