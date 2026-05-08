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

class FamilyCommunicationDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void alertCreateRequestRequiresCoreFields() {
        FamilyAlertCreateRequest request = new FamilyAlertCreateRequest(
            "",
            0L,
            "unknown",
            "critical",
            null,
            "",
            "service",
            "family",
            Map.of("schedule_id", 12)
        );

        var violations = validator.validate(request);

        assertEquals(6, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("alertType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("level")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("message")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("source")));
    }

    @Test
    void alertCreateRequestKeepsAlertKeys() {
        FamilyAlertCreateRequest request = new FamilyAlertCreateRequest(
            "family_001",
            7L,
            "medication",
            "high",
            "用药提醒",
            "老人尚未完成晚间用药",
            "family",
            "family",
            Map.of("schedule_id", 12)
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals("medication", data.get("alert_type"));
        assertEquals("high", data.get("level"));
        assertEquals("用药提醒", data.get("title"));
        assertEquals("family", data.get("source"));
        assertEquals(Map.of("schedule_id", 12), data.get("metadata"));
    }

    @Test
    void alertHandleAndReplyRequestsKeepFamilyScope() {
        FamilyAlertHandleRequest handle = new FamilyAlertHandleRequest("family_001", 3L, "已电话确认");
        FamilyAlertReplyRequest reply = new FamilyAlertReplyRequest("family_001", "马上联系你");

        assertEquals("family_001", handle.toMap().get("family_id"));
        assertEquals(3L, handle.toMap().get("handled_by"));
        assertEquals("已电话确认", handle.toMap().get("reply_message"));
        assertEquals("family_001", reply.toMap().get("family_id"));
        assertEquals("马上联系你", reply.toMap().get("reply_message"));
    }

    @Test
    void familyMessageRequestRequiresScheduledPayload() {
        FamilyMessageCreateRequest request = new FamilyMessageCreateRequest("", "", "", "", "");

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("content")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("senderName")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("senderRelation")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("scheduledTime")));
    }

    @Test
    void familyMessageRequestKeepsMessageKeys() {
        FamilyMessageCreateRequest request = new FamilyMessageCreateRequest(
            "family_001",
            "今晚记得早点休息",
            "小明",
            "儿子",
            "2026-05-08 19:30:00"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals("今晚记得早点休息", data.get("content"));
        assertEquals("小明", data.get("sender_name"));
        assertEquals("儿子", data.get("sender_relation"));
        assertEquals("2026-05-08 19:30:00", data.get("scheduled_time"));
    }

    @Test
    void alertCreateRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(FamilyAlertCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(FamilyAlertCreateRequest.class, "alertType").getAccessor().getAnnotation(Schema.class);
        assertEquals("medication", type.example());
        assertTrue(List.of(type.allowableValues()).contains("ai_crisis"));
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
