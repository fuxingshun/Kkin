package com.kinecho.server.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrivacyConsentAndBindingDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void consentRequestRequiresFamilyTypeAndVersion() {
        ConsentRecordCreateRequest request = new ConsentRecordCreateRequest(
            "",
            0L,
            -1L,
            "",
            "",
            true,
            null,
            null,
            null,
            Map.of("scene", "onboarding")
        );

        var violations = validator.validate(request);

        assertEquals(5, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("elderlyId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("userId")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("consentType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("version")));
    }

    @Test
    void consentRequestKeepsAuditKeys() {
        ConsentRecordCreateRequest request = new ConsentRecordCreateRequest(
            "family_001",
            7L,
            12L,
            "privacy-policy",
            "v1",
            false,
            "family",
            "小明",
            "miniapp",
            Map.of("scene", "onboarding")
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertEquals(7L, data.get("elderly_id"));
        assertEquals(12L, data.get("user_id"));
        assertEquals("privacy-policy", data.get("consent_type"));
        assertEquals("v1", data.get("version"));
        assertEquals(false, data.get("accepted"));
        assertEquals("family", data.get("actor_role"));
        assertEquals("小明", data.get("actor_name"));
        assertEquals("miniapp", data.get("source"));
        assertEquals(Map.of("scene", "onboarding"), data.get("metadata"));
    }

    @Test
    void bindByCodeRequestRequiresCodeAndName() {
        FamilyBindByCodeRequest request = new FamilyBindByCodeRequest("abc", "", null, null, null);

        var violations = validator.validate(request);

        assertEquals(2, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("bindingCode")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("name")));
    }

    @Test
    void bindByCodeRequestKeepsBindingKeys() {
        FamilyBindByCodeRequest request = new FamilyBindByCodeRequest(
            "ab12cd34",
            "女儿",
            "13900000000",
            "openid_xxx",
            "family"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("ab12cd34", data.get("binding_code"));
        assertEquals("女儿", data.get("name"));
        assertEquals("13900000000", data.get("phone"));
        assertEquals("openid_xxx", data.get("wechat_openid"));
        assertEquals("family", data.get("operator"));
    }

    @Test
    void consentRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(ConsentRecordCreateRequest.class.getAnnotation(Schema.class));
        Schema type = recordComponent(ConsentRecordCreateRequest.class, "consentType").getAccessor().getAnnotation(Schema.class);
        assertEquals("privacy-policy", type.example());
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
