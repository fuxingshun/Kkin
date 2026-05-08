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

class ScheduleDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestRequiresFamilyTitleAndTime() {
        ScheduleCreateRequest request = new ScheduleCreateRequest(
            "",
            "",
            null,
            "sleep",
            "",
            "yearly",
            null,
            2,
            0L
        );

        var violations = validator.validate(request);

        assertEquals(7, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("title")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("scheduleType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("scheduleTime")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("repeatType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("autoRemind")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("createdBy")));
    }

    @Test
    void createRequestKeepsScheduleKeys() {
        ScheduleCreateRequest request = new ScheduleCreateRequest(
            "family_001",
            "晚间用药",
            "餐后 30 分钟服药",
            "medication",
            "2026-05-08 20:00:00",
            "daily",
            "1,3,5",
            1,
            7L
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals("晚间用药", data.get("title"));
        assertEquals("medication", data.get("schedule_type"));
        assertEquals("2026-05-08 20:00:00", data.get("schedule_time"));
        assertEquals("daily", data.get("repeat_type"));
        assertEquals("1,3,5", data.get("repeat_days"));
        assertEquals(1, data.get("auto_remind"));
        assertEquals(7L, data.get("created_by"));
    }

    @Test
    void updateRequestKeepsPartialStatusKeys() {
        ScheduleUpdateRequest request = new ScheduleUpdateRequest(
            "family_001",
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            "skipped"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(0, data.get("auto_remind"));
        assertEquals("skipped", data.get("status"));
        assertFalse(data.containsKey("title"));
    }

    @Test
    void statusRequestRequiresKnownStatus() {
        ScheduleStatusRequest request = new ScheduleStatusRequest("family_001", "done", -1L);

        var violations = validator.validate(request);

        assertEquals(2, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("status")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
    }

    @Test
    void createRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ScheduleCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(ScheduleCreateRequest.class, "scheduleType").getAccessor().getAnnotation(Schema.class);
        assertEquals("medication", type.example());
        assertTrue(List.of(type.allowableValues()).contains("checkup"));
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
