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

class AdminContentDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void counselorUpdateValidatesStateFlags() {
        AdminCounselorUpdateRequest request = new AdminCounselorUpdateRequest(2, -1, "试点期间可预约", Map.of("weekday", List.of("19:00")));

        var violations = validator.validate(request);

        assertEquals(2, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("available")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("isActive")));
    }

    @Test
    void counselorUpdateKeepsScheduleKeys() {
        AdminCounselorUpdateRequest request = new AdminCounselorUpdateRequest(1, 1, "试点期间可预约", Map.of("weekday", List.of("19:00")));

        Map<String, Object> data = request.toMap();

        assertEquals(1, data.get("available"));
        assertEquals(1, data.get("is_active"));
        assertEquals("试点期间可预约", data.get("availability_text"));
        assertEquals(Map.of("weekday", List.of("19:00")), data.get("calendar"));
    }

    @Test
    void psychologyVideoCreateRequiresCoreFields() {
        AdminPsychologyVideoCreateRequest request = new AdminPsychologyVideoCreateRequest(
            "",
            "",
            null,
            null,
            null,
            null,
            null,
            "",
            null,
            null,
            List.of("固定睡眠时间"),
            -1,
            2
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("slug")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("title")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("sourceUrl")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("sortOrder")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("isActive")));
    }

    @Test
    void psychologyVideoCreateKeepsContentKeys() {
        AdminPsychologyVideoCreateRequest request = new AdminPsychologyVideoCreateRequest(
            "sleep-care",
            "睡眠照护练习",
            "睡眠",
            "5 分钟",
            "心理咨询师",
            "帮助老人建立睡前放松习惯",
            "https://example.com/poster.jpg",
            "https://example.com/video.mp4",
            "pilot",
            "sleep",
            List.of("固定睡眠时间", "减少睡前刺激"),
            1,
            1
        );

        Map<String, Object> data = request.toMap();

        assertEquals("sleep-care", data.get("slug"));
        assertEquals("睡眠照护练习", data.get("title"));
        assertEquals("https://example.com/video.mp4", data.get("source_url"));
        assertEquals("sleep", data.get("cover_class_name"));
        assertEquals(List.of("固定睡眠时间", "减少睡前刺激"), data.get("takeaways"));
        assertEquals(1, data.get("sort_order"));
        assertEquals(1, data.get("is_active"));
    }

    @Test
    void psychologyQuestionCreateRequiresQuestion() {
        AdminPsychologyQuestionCreateRequest request = new AdminPsychologyQuestionCreateRequest("", -1, 2);

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("question")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("sortOrder")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("isActive")));
    }

    @Test
    void updateRequestsKeepPartialFields() {
        AdminPsychologyVideoUpdateRequest video = new AdminPsychologyVideoUpdateRequest(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0
        );
        AdminPsychologyQuestionUpdateRequest question = new AdminPsychologyQuestionUpdateRequest(null, 3, 0);

        assertEquals(0, video.toMap().get("is_active"));
        assertFalse(video.toMap().containsKey("title"));
        assertEquals(3, question.toMap().get("sort_order"));
        assertEquals(0, question.toMap().get("is_active"));
    }

    @Test
    void psychologyVideoCreateExposesOpenApiSchemaMetadata() {
        assertNotNull(AdminPsychologyVideoCreateRequest.class.getAnnotation(Schema.class));
        Schema sourceUrl = recordComponent(AdminPsychologyVideoCreateRequest.class, "sourceUrl").getAccessor().getAnnotation(Schema.class);
        assertEquals("https://example.com/video.mp4", sourceUrl.example());
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
