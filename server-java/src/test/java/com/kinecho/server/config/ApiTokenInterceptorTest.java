package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ApiTokenInterceptorTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void allowsRequestsWhenTokenProtectionDisabled() throws Exception {
        KinEchoProperties properties = new KinEchoProperties();
        ApiTokenInterceptor interceptor = new ApiTokenInterceptor(properties, mapper);

        assertTrue(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/users/family_001"), new MockHttpServletResponse(), new Object()));
    }

    @Test
    void acceptsBearerTokenWhenProtectionEnabled() throws Exception {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setApiTokenEnabled(true);
        properties.setApiToken("secret-token");
        ApiTokenInterceptor interceptor = new ApiTokenInterceptor(properties, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/family_001");
        request.addHeader("Authorization", "Bearer secret-token");

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void rejectsMissingTokenWhenProtectionEnabled() throws Exception {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setApiTokenEnabled(true);
        properties.setApiToken("secret-token");
        ApiTokenInterceptor interceptor = new ApiTokenInterceptor(properties, mapper);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/users/family_001"), response, new Object()));
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"invalid_api_token\""));
        assertTrue(response.getContentAsString().contains("\"request_id\""));
    }
}
