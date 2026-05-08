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

class ServiceCertificationDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void submitRequestRequiresIdentityFields() {
        ServiceCertificationSubmitRequest request = new ServiceCertificationSubmitRequest(
            "",
            "",
            "",
            "",
            ""
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("openid")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("staffNo")));
    }

    @Test
    void submitRequestKeepsServiceKeys() {
        ServiceCertificationSubmitRequest request = new ServiceCertificationSubmitRequest(
            "wx_service_001",
            "张护工",
            "13900000000",
            "S001",
            "KinEcho Care"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("wx_service_001", data.get("openid"));
        assertEquals("张护工", data.get("name"));
        assertEquals("13900000000", data.get("phone"));
        assertEquals("S001", data.get("staff_no"));
        assertEquals("KinEcho Care", data.get("organization"));
    }

    @Test
    void reviewRequestKeepsRejectReasonFallback() {
        ServiceCertificationReviewRequest request = new ServiceCertificationReviewRequest(
            "rejected",
            "admin",
            null,
            "证件信息不完整"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("rejected", data.get("status"));
        assertEquals("admin", data.get("reviewer"));
        assertFalse(data.containsKey("reject_reason"));
        assertEquals("证件信息不完整", data.get("reason"));
    }

    @Test
    void reviewRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ServiceCertificationReviewRequest.class.getAnnotation(Schema.class));
        Schema status = recordComponent(ServiceCertificationReviewRequest.class, "status").getAccessor().getAnnotation(Schema.class);
        assertEquals("approved", status.example());
        assertTrue(List.of(status.allowableValues()).contains("rejected"));
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
