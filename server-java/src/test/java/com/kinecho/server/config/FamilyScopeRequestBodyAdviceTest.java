package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.service.SessionTokenCodec;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Type;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FamilyScopeRequestBodyAdviceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void allowsBodyWithoutFamilyIdForCompatibility() {
        FamilyScopeRequestBodyAdvice advice = new FamilyScopeRequestBodyAdvice(properties(), mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/family/alerts");

        assertDoesNotThrow(() -> advice.afterBodyRead(Map.of("title", "demo"), input(request), parameter(), targetType(), converterType()));
    }

    @Test
    void rejectsBodyFamilyIdWithoutSessionWhenRequired() {
        KinEchoProperties properties = properties();
        properties.setFamilyScopeSessionRequired(true);
        FamilyScopeRequestBodyAdvice advice = new FamilyScopeRequestBodyAdvice(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/family/alerts");

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
            () -> advice.afterBodyRead(Map.of("family_id", "family_001"), input(request), parameter(), targetType(), converterType()));

        assertEquals(401, error.getStatusCode().value());
    }

    @Test
    void allowsMatchingFamilyIdWhenSessionIsPresent() {
        KinEchoProperties properties = properties();
        FamilyScopeRequestBodyAdvice advice = new FamilyScopeRequestBodyAdvice(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/family/alerts");
        request.addHeader("X-KinEcho-Session", token(properties, "family", "family_001"));

        assertDoesNotThrow(() -> advice.afterBodyRead(Map.of("family_id", "family_001"), input(request), parameter(), targetType(), converterType()));
    }

    @Test
    void rejectsCrossFamilyBodyWhenSessionIsPresent() {
        KinEchoProperties properties = properties();
        FamilyScopeRequestBodyAdvice advice = new FamilyScopeRequestBodyAdvice(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/family/alerts");
        request.addHeader("X-KinEcho-Session", token(properties, "family", "family_001"));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
            () -> advice.afterBodyRead(Map.of("family_id", "family_002"), input(request), parameter(), targetType(), converterType()));

        assertEquals(403, error.getStatusCode().value());
    }

    @Test
    void allowsAdminBodyForAnyFamily() {
        KinEchoProperties properties = properties();
        FamilyScopeRequestBodyAdvice advice = new FamilyScopeRequestBodyAdvice(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/family/alerts");
        request.addHeader("X-KinEcho-Session", token(properties, "admin", ""));

        assertDoesNotThrow(() -> advice.afterBodyRead(Map.of("family_id", "family_002"), input(request), parameter(), targetType(), converterType()));
    }

    private KinEchoProperties properties() {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setSessionSigningKey("test-session-secret");
        return properties;
    }

    private String token(KinEchoProperties properties, String role, String familyId) {
        return SessionTokenCodec.create(Map.of(
            "success", true,
            "role", role,
            "user_id", 9L,
            "display_name", "tester",
            "family_id", familyId
        ), properties, mapper);
    }

    private org.springframework.http.HttpInputMessage input(MockHttpServletRequest request) {
        return new org.springframework.http.server.ServletServerHttpRequest(request);
    }

    private MethodParameter parameter() {
        return null;
    }

    private Type targetType() {
        return Map.class;
    }

    @SuppressWarnings("unchecked")
    private Class<? extends HttpMessageConverter<?>> converterType() {
        return (Class<? extends HttpMessageConverter<?>>) (Class<?>) HttpMessageConverter.class;
    }
}
