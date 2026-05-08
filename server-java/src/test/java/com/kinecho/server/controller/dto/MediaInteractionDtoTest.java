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

class MediaInteractionDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void mediaUpdateRequiresFamilyAndNonNegativePolicyValues() {
        MediaUpdateRequest request = new MediaUpdateRequest(
            "",
            null,
            null,
            null,
            null,
            null,
            null,
            -1,
            -2
        );

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("cooldown")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("priority")));
    }

    @Test
    void mediaUpdateKeepsPolicyKeys() {
        MediaUpdateRequest request = new MediaUpdateRequest(
            "family_001",
            "生日照片",
            "去年生日聚会",
            List.of("family", "birthday"),
            List.of("19:00-21:00"),
            List.of("calm"),
            List.of("birthday"),
            60,
            5
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals("生日照片", data.get("title"));
        assertEquals(List.of("family", "birthday"), data.get("tags"));
        assertEquals(List.of("19:00-21:00"), data.get("time_windows"));
        assertEquals(List.of("calm"), data.get("moods"));
        assertEquals(List.of("birthday"), data.get("occasions"));
        assertEquals(60, data.get("cooldown"));
        assertEquals(5, data.get("priority"));
    }

    @Test
    void mediaPlayRequiresPositiveElderlyAndValidCompletedFlag() {
        MediaPlayRecordRequest request = new MediaPlayRecordRequest(0L, -1, 2, null, null, null);

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("durationWatched")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("completed")));
    }

    @Test
    void mediaFeedbackRequiresKnownType() {
        MediaFeedbackRequest request = new MediaFeedbackRequest(-1L, "love");

        var violations = validator.validate(request);

        assertEquals(2, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("feedbackType")));
    }

    @Test
    void mediaFeedbackKeepsFeedbackKeys() {
        MediaFeedbackRequest request = new MediaFeedbackRequest(7L, "like");

        Map<String, Object> data = request.toMap();

        assertEquals(7L, data.get("elderly_id"));
        assertEquals("like", data.get("feedback_type"));
        assertFalse(data.containsKey("family_id"));
    }

    @Test
    void mediaFeedbackExposesOpenApiSchemaMetadata() {
        assertNotNull(MediaFeedbackRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(MediaFeedbackRequest.class, "feedbackType").getAccessor().getAnnotation(Schema.class);
        assertEquals("like", type.example());
        assertTrue(List.of(type.allowableValues()).contains("dislike"));
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
