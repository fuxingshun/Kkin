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

class ConsultationDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestRequiresFamilyAndSchedule() {
        ConsultationCreateRequest request = new ConsultationCreateRequest(
            "",
            0L,
            null,
            "chat",
            "",
            null,
            "pending",
            null,
            true,
            "medium",
            "睡眠咨询"
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("consultationType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("scheduledTime")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("status")));
    }

    @Test
    void createRequestKeepsConsultationServiceKeys() {
        ConsultationCreateRequest request = new ConsultationCreateRequest(
            "family_001",
            7L,
            88L,
            "phone",
            "2026-05-08 10:00:00",
            45,
            "scheduled",
            "希望电话沟通睡眠问题",
            true,
            "high",
            "睡眠咨询"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals(88L, data.get("counselor_id"));
        assertEquals("phone", data.get("consultation_type"));
        assertEquals("2026-05-08 10:00:00", data.get("scheduled_time"));
        assertEquals(true, data.get("notify_service"));
        assertEquals("high", data.get("concern_level"));
    }

    @Test
    void updateRequestKeepsCancellationFallback() {
        ConsultationUpdateRequest request = new ConsultationUpdateRequest(
            "family_001",
            null,
            null,
            null,
            "cancelled",
            null,
            "老人临时有事",
            null
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals("cancelled", data.get("status"));
        assertFalse(data.containsKey("note"));
        assertEquals("老人临时有事", data.get("cancel_reason"));
    }

    @Test
    void createRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ConsultationCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(ConsultationCreateRequest.class, "consultationType").getAccessor().getAnnotation(Schema.class);
        assertEquals("phone", type.example());
        assertTrue(List.of(type.allowableValues()).contains("text"));
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
