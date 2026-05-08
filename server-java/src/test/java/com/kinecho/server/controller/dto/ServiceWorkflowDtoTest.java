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

class ServiceWorkflowDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void followupCreateRequestRequiresFamilyElderlyAndSchedule() {
        ServiceFollowupCreateRequest request = new ServiceFollowupCreateRequest(
            "",
            0L,
            null,
            "chat",
            "",
            null,
            "pending",
            "note"
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("consultationType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("scheduledTime")));
    }

    @Test
    void followupCreateRequestKeepsServiceKeys() {
        ServiceFollowupCreateRequest request = new ServiceFollowupCreateRequest(
            "family_001",
            7L,
            3L,
            "phone",
            "2026-05-08 10:00:00",
            30,
            "scheduled",
            "电话回访睡眠情况"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals(3L, data.get("counselor_id"));
        assertEquals("phone", data.get("consultation_type"));
        assertEquals("2026-05-08 10:00:00", data.get("scheduled_time"));
    }

    @Test
    void statusRequestKeepsCancellationFallback() {
        ServiceFollowupStatusRequest request = new ServiceFollowupStatusRequest(
            "family_001",
            "cancelled",
            null,
            null,
            "老人临时有事"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals("cancelled", data.get("status"));
        assertFalse(data.containsKey("note"));
        assertEquals("老人临时有事", data.get("cancel_reason"));
    }

    @Test
    void serviceRecordRequestKeepsAlertAndContent() {
        ServiceRecordCreateRequest request = new ServiceRecordCreateRequest(
            "family_001",
            7L,
            55L,
            null,
            "已电话回访，老人状态平稳",
            null,
            15
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals(55L, data.get("alert_id"));
        assertEquals("已电话回访，老人状态平稳", data.get("content"));
        assertEquals(15, data.get("duration"));
    }

    @Test
    void followupCreateRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ServiceFollowupCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(ServiceFollowupCreateRequest.class, "consultationType").getAccessor().getAnnotation(Schema.class);
        assertEquals("phone", type.example());
        assertTrue(List.of(type.allowableValues()).contains("video"));
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
