package com.kinecho.server.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ElderlyCareDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void elderlyAlertRequiresCoreFields() {
        ElderlyAlertCreateRequest request = new ElderlyAlertCreateRequest(
            "",
            0L,
            "unknown",
            "critical",
            null,
            "",
            Map.of("button", "sos")
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("alertType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("level")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("message")));
    }

    @Test
    void elderlyAlertKeepsAlertKeys() {
        ElderlyAlertCreateRequest request = new ElderlyAlertCreateRequest(
            "family_001",
            7L,
            "sos_emergency",
            "high",
            "紧急求助",
            "我需要帮助",
            Map.of("button", "sos")
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals("sos_emergency", data.get("alert_type"));
        assertEquals("high", data.get("level"));
        assertEquals("紧急求助", data.get("title"));
        assertEquals("我需要帮助", data.get("message"));
        assertEquals(Map.of("button", "sos"), data.get("metadata"));
    }

    @Test
    void moodRequestRequiresKnownMoodAndScoreRange() {
        ElderlyMoodCreateRequest request = new ElderlyMoodCreateRequest(
            "",
            -1L,
            "sleepy",
            11,
            null,
            null,
            null,
            null,
            null,
            null
        );

        var violations = validator.validate(request);

        assertEquals(4, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("moodType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("moodScore")));
    }

    @Test
    void moodRequestKeepsMoodKeys() {
        ElderlyMoodCreateRequest request = new ElderlyMoodCreateRequest(
            "family_001",
            7L,
            "calm",
            8,
            "今天状态不错",
            "manual",
            "morning_checkin",
            "home",
            "sunny",
            "2026-05-08 09:30:00"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals("calm", data.get("mood_type"));
        assertEquals(8, data.get("mood_score"));
        assertEquals("manual", data.get("source"));
        assertEquals("morning_checkin", data.get("trigger_event"));
        assertEquals("2026-05-08 09:30:00", data.get("recorded_at"));
    }

    @Test
    void moodRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ElderlyMoodCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(ElderlyMoodCreateRequest.class, "moodType").getAccessor().getAnnotation(Schema.class);
        assertEquals("calm", type.example());
        assertTrue(List.of(type.allowableValues()).contains("anxious"));
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
