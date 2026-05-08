package com.kinecho.server.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import org.springframework.http.HttpHeaders;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SessionTokenCodec {
    private SessionTokenCodec() {
    }

    public static String create(Map<String, Object> body, KinEchoProperties properties, ObjectMapper mapper) {
        Map<String, Object> payload = new LinkedHashMap<>();
        for (String key : List.of(
            "role", "user_id", "username", "display_name", "openid",
            "family_id", "elderly_id", "elderly_name", "family_user_id", "family_name"
        )) {
            Object value = body.get(key);
            if (value != null && !String.valueOf(value).isBlank()) {
                payload.put(key, value);
            }
        }

        return createSignedPayload(payload, properties.sessionTtlSeconds, properties, mapper);
    }

    public static String createSignedPayload(Map<String, Object> claims,
                                             long ttlSeconds,
                                             KinEchoProperties properties,
                                             ObjectMapper mapper) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (claims != null) {
            claims.forEach((key, value) -> {
                if (key != null && value != null && !String.valueOf(value).isBlank()) {
                    payload.put(key, value);
                }
            });
        }
        long now = Instant.now().getEpochSecond();
        payload.put("iat", now);
        payload.put("exp", now + Math.max(60, ttlSeconds));
        try {
            String encodedPayload = base64Url(mapper.writeValueAsBytes(payload));
            return encodedPayload + "." + sign(encodedPayload, properties);
        } catch (Exception error) {
            throw new IllegalStateException("failed to create signed token", error);
        }
    }

    public static Map<String, Object> verify(String token, KinEchoProperties properties, ObjectMapper mapper) {
        return verifySignedPayload(token, properties, mapper);
    }

    public static Map<String, Object> verifySignedPayload(String token, KinEchoProperties properties, ObjectMapper mapper) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
            return null;
        }
        if (!constantTimeEquals(sign(parts[0], properties), parts[1])) {
            return null;
        }

        try {
            Map<String, Object> payload = mapper.readValue(Base64.getUrlDecoder().decode(parts[0]), new TypeReference<>() {});
            long expiresAt = longValue(payload.get("exp"));
            if (expiresAt <= Instant.now().getEpochSecond()) {
                return null;
            }
            return payload;
        } catch (Exception ignored) {
            return null;
        }
    }

    public static String extract(String sessionToken, String authorization, KinEchoProperties properties) {
        if (sessionToken != null && !sessionToken.isBlank()) {
            return sessionToken.trim();
        }
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String bearer = authorization.substring(7).trim();
            return bearer.equals(properties.apiToken) ? "" : bearer;
        }
        return "";
    }

    public static String extract(jakarta.servlet.http.HttpServletRequest request, KinEchoProperties properties) {
        return extract(request.getHeader("X-KinEcho-Session"), request.getHeader(HttpHeaders.AUTHORIZATION), properties);
    }

    private static String sign(String value, KinEchoProperties properties) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(sessionSecret(properties).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return base64Url(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("failed to sign session token", error);
        }
    }

    private static String sessionSecret(KinEchoProperties properties) {
        if (properties.sessionSigningKey != null && !properties.sessionSigningKey.isBlank()) {
            return properties.sessionSigningKey;
        }
        if (properties.apiToken != null && !properties.apiToken.isBlank()) {
            return properties.apiToken;
        }
        return "kinecho-dev-session-signing-key";
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean constantTimeEquals(String left, String right) {
        return MessageDigest.isEqual(
            left.getBytes(StandardCharsets.UTF_8),
            right.getBytes(StandardCharsets.UTF_8)
        );
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
}
