package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.service.SessionTokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FamilyScopeInterceptor implements HandlerInterceptor {
    private static final Pattern USERS_FAMILY_PATH = Pattern.compile("^/api/users/([^/]+)$");

    private final KinEchoProperties properties;
    private final ObjectMapper mapper;

    public FamilyScopeInterceptor(KinEchoProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String requestedFamilyId = requestedFamilyId(request);
        if (requestedFamilyId.isBlank()) {
            return true;
        }

        String token = SessionTokenCodec.extract(request, properties);
        if (token.isBlank()) {
            if (properties.familyScopeSessionRequired) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "session token is required");
                return false;
            }
            return true;
        }

        Map<String, Object> session = SessionTokenCodec.verify(token, properties, mapper);
        if (session == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "invalid session token");
            return false;
        }

        if ("admin".equals(String.valueOf(session.get("role")))) {
            return true;
        }

        String sessionFamilyId = String.valueOf(session.getOrDefault("family_id", "")).trim();
        if (!requestedFamilyId.equals(sessionFamilyId)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "family scope mismatch");
            return false;
        }

        return true;
    }

    private String requestedFamilyId(HttpServletRequest request) {
        String familyId = request.getParameter("family_id");
        if (familyId != null && !familyId.isBlank()) {
            return familyId.trim();
        }

        Matcher matcher = USERS_FAMILY_PATH.matcher(request.getRequestURI());
        if (matcher.matches()) {
            return URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8).trim();
        }

        return "";
    }
}
