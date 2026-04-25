package com.kinecho.server.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.HandlerInterceptor;

public class ApiTokenInterceptor implements HandlerInterceptor {
    private static final String TOKEN_HEADER = "X-KinEcho-Token";
    private final KinEchoProperties properties;

    public ApiTokenInterceptor(KinEchoProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!properties.apiTokenEnabled || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        if (properties.apiToken == null || properties.apiToken.isBlank()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "api token is not configured");
            return false;
        }

        if (properties.apiToken.equals(extractToken(request))) {
            return true;
        }

        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "invalid api token");
        return false;
    }

    private String extractToken(HttpServletRequest request) {
        String token = request.getHeader(TOKEN_HEADER);
        if (token != null && !token.isBlank()) {
            return token.trim();
        }

        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorization.substring(7).trim();
        }

        return "";
    }
}
