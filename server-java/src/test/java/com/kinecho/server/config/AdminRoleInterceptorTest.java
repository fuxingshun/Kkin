package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.mapper.KinEchoMapper;
import com.kinecho.server.service.SessionTokenCodec;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminRoleInterceptorTest {
    private final KinEchoProperties properties = new KinEchoProperties();
    private final ObjectMapper mapper = new ObjectMapper();
    private final KinEchoMapper db = mock(KinEchoMapper.class);
    private final AdminRoleInterceptor interceptor = new AdminRoleInterceptor(properties, mapper, db);

    @Test
    void allowsAdminSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/families");
        request.addHeader("X-KinEcho-Session", token("admin"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(interceptor.preHandle(request, response, new Object()));
        assertEquals(200, response.getStatus());
    }

    @Test
    void rejectsMissingSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/families");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
    }

    @Test
    void rejectsNonAdminSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/families");
        request.addHeader("X-KinEcho-Session", token("family"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void allowsOptionsPreflight() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/admin/families");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(interceptor.preHandle(request, response, new Object()));
    }

    @Test
    void rejectsRotatedAdminSession() throws Exception {
        when(db.one("""
                SELECT disabled, session_version
                FROM auth_accounts
                WHERE id = ? AND role = 'admin'
                LIMIT 1
                """, 7L)).thenReturn(Optional.of(Map.of(
            "disabled", 0,
            "session_version", 2
        )));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/families");
        request.addHeader("X-KinEcho-Session", SessionTokenCodec.create(Map.of(
            "role", "admin",
            "auth_account_id", 7L,
            "session_version", 1
        ), properties, mapper));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
    }

    @Test
    void allowsAdminAuthPathWithAuthPermission() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/auth/accounts");
        request.addHeader("X-KinEcho-Session", token("admin", "admin:auth"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(interceptor.preHandle(request, response, new Object()));
    }

    @Test
    void rejectsAdminAuthPathWithoutAuthPermission() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/auth/accounts");
        request.addHeader("X-KinEcho-Session", token("admin", "admin:privacy"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    private String token(String role) {
        return token(role, "");
    }

    private String token(String role, String permission) {
        return SessionTokenCodec.create(Map.of(
            "role", role,
            "user_id", 1L,
            "display_name", role,
            "permissions", permission
        ), properties, mapper);
    }
}
