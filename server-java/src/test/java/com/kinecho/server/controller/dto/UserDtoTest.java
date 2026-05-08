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

class UserDtoTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestRequiresRoleNameAndFamily() {
        UserCreateRequest request = new UserCreateRequest(
            "guest",
            "",
            "",
            "",
            null,
            null,
            null,
            "admin"
        );

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("userType")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("name")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("familyId")));
    }

    @Test
    void createRequestKeepsUserServiceKeys() {
        UserCreateRequest request = new UserCreateRequest(
            "elderly",
            "王阿姨",
            "13900000000",
            "family_001",
            "wx_family_001",
            null,
            null,
            "admin"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("elderly", data.get("user_type"));
        assertEquals("王阿姨", data.get("name"));
        assertEquals("13900000000", data.get("phone"));
        assertEquals("family_001", data.get("family_id"));
        assertEquals("wx_family_001", data.get("wechat_openid"));
        assertEquals("admin", data.get("operator"));
    }

    @Test
    void updateRequestOnlySendsPresentMutableFields() {
        UserUpdateRequest request = new UserUpdateRequest(
            "family_001",
            null,
            "13900000001",
            null,
            "admin"
        );

        Map<String, Object> data = request.toMap();

        assertEquals("family_001", data.get("family_id"));
        assertFalse(data.containsKey("name"));
        assertEquals("13900000001", data.get("phone"));
        assertEquals("admin", data.get("operator"));
    }

    @Test
    void createRequestExposesOpenApiSchemaMetadata() {
        assertNotNull(UserCreateRequest.class.getAnnotation(Schema.class));
        Schema userType = recordComponent(UserCreateRequest.class, "userType").getAccessor().getAnnotation(Schema.class);
        assertEquals("elderly", userType.example());
        assertTrue(List.of(userType.allowableValues()).contains("family"));
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
