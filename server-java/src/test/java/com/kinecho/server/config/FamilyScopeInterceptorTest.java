package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.service.SessionTokenCodec;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FamilyScopeInterceptorTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void allowsRequestsWithoutSessionForCompatibility() throws Exception {
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties(), mapper);

        assertTrue(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/family/alerts"), new MockHttpServletResponse(), new Object()));
    }

    @Test
    void rejectsFamilyQueryWithoutSessionWhenRequired() throws Exception {
        KinEchoProperties properties = properties();
        properties.setFamilyScopeSessionRequired(true);
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/family/alerts");
        request.addParameter("family_id", "family_001");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
    }

    @Test
    void allowsMatchingFamilyQueryWhenSessionIsPresent() throws Exception {
        KinEchoProperties properties = properties();
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/family/alerts");
        request.addParameter("family_id", "family_001");
        request.addHeader("X-KinEcho-Session", token(properties, "family", "family_001"));

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void rejectsCrossFamilyQueryWhenSessionIsPresent() throws Exception {
        KinEchoProperties properties = properties();
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/family/alerts");
        request.addParameter("family_id", "family_002");
        request.addHeader("X-KinEcho-Session", token(properties, "family", "family_001"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void rejectsCrossFamilyUsersPathWhenSessionIsPresent() throws Exception {
        KinEchoProperties properties = properties();
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/family_002");
        request.addHeader("X-KinEcho-Session", token(properties, "family", "family_001"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void allowsAdminToSelectAnyFamily() throws Exception {
        KinEchoProperties properties = properties();
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/family/alerts");
        request.addParameter("family_id", "family_002");
        request.addHeader("X-KinEcho-Session", token(properties, "admin", ""));

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void rejectsInvalidSessionToken() throws Exception {
        FamilyScopeInterceptor interceptor = new FamilyScopeInterceptor(properties(), mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/family/alerts");
        request.addParameter("family_id", "family_001");
        request.addHeader("X-KinEcho-Session", "not-a-session");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
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
}
