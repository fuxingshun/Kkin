package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

final class ErrorResponseWriter {
    private ErrorResponseWriter() {
    }

    static void write(HttpServletResponse response, ObjectMapper mapper, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("code", code);
        body.put("message", message);
        body.put("request_id", UUID.randomUUID().toString());
        mapper.writeValue(response.getWriter(), body);
    }
}
