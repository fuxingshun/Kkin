package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.mapper.KinEchoMapper;
import com.kinecho.server.service.SessionTokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;

public class AdminRoleInterceptor implements HandlerInterceptor {
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;
    private final KinEchoMapper db;

    public AdminRoleInterceptor(KinEchoProperties properties, ObjectMapper mapper, KinEchoMapper db) {
        this.properties = properties;
        this.mapper = mapper;
        this.db = db;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String token = SessionTokenCodec.extract(request, properties);
        if (token.isBlank()) {
            ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_UNAUTHORIZED, "admin_session_required", "admin session token is required");
            return false;
        }

        Map<String, Object> session = SessionTokenCodec.verify(token, properties, mapper);
        if (session == null) {
            ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_UNAUTHORIZED, "invalid_admin_session", "invalid admin session token");
            return false;
        }

        if (!"admin".equals(String.valueOf(session.get("role")))) {
            ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_FORBIDDEN, "admin_role_required", "admin role is required");
            return false;
        }

        String requiredPermission = requiredPermission(request);
        if (!requiredPermission.isBlank() && !hasPermission(session.get("permissions"), requiredPermission)) {
            ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_FORBIDDEN, "admin_permission_required", "admin permission is required");
            return false;
        }

        long accountId = longValue(session.get("auth_account_id"));
        if (accountId > 0) {
            Map<String, Object> account = db.one("""
                SELECT disabled, session_version
                FROM auth_accounts
                WHERE id = ? AND role = 'admin'
                LIMIT 1
            """, accountId).orElse(null);
            if (account == null || boolValue(account.get("disabled"))) {
                ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_UNAUTHORIZED, "admin_account_inactive", "admin account is no longer active");
                return false;
            }
            int tokenVersion = intValue(session.get("session_version"), 1);
            int currentVersion = intValue(account.get("session_version"), 1);
            if (tokenVersion != currentVersion) {
                ErrorResponseWriter.write(response, mapper, HttpServletResponse.SC_UNAUTHORIZED, "admin_session_rotated", "admin session has been rotated");
                return false;
            }
        }

        return true;
    }

    private static String requiredPermission(HttpServletRequest request) {
        String path = request.getRequestURI() == null ? "" : request.getRequestURI();
        if (path.startsWith("/api/admin/auth/")) {
            return "admin:auth";
        }
        return "";
    }

    private static boolean hasPermission(Object raw, String requiredPermission) {
        if (requiredPermission == null || requiredPermission.isBlank()) {
            return true;
        }
        if (raw instanceof Iterable<?> values) {
            for (Object value : values) {
                if (permissionMatches(String.valueOf(value), requiredPermission)) {
                    return true;
                }
            }
            return false;
        }
        String value = raw == null ? "" : String.valueOf(raw);
        for (String part : value.split(",")) {
            if (permissionMatches(part, requiredPermission)) {
                return true;
            }
        }
        return false;
    }

    private static boolean permissionMatches(String value, String requiredPermission) {
        String permission = value == null ? "" : value.trim();
        return permission.equals(requiredPermission)
            || permission.equals("admin:*")
            || permission.equals("admin:legacy");
    }

    private static int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static boolean boolValue(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        return value != null && ("true".equalsIgnoreCase(value.toString()) || "1".equals(value.toString()));
    }
}
