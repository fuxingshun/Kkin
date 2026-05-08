package com.kinecho.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.service.SessionTokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import java.lang.reflect.Type;
import java.util.Map;

@ControllerAdvice
public class FamilyScopeRequestBodyAdvice extends RequestBodyAdviceAdapter {
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;

    public FamilyScopeRequestBodyAdvice(KinEchoProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public boolean supports(MethodParameter methodParameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object afterBodyRead(Object body,
                                HttpInputMessage inputMessage,
                                MethodParameter parameter,
                                Type targetType,
                                Class<? extends HttpMessageConverter<?>> converterType) {
        if (body instanceof Map<?, ?> map && inputMessage instanceof ServletServerHttpRequest servletRequest) {
            enforceFamilyScope(map.get("family_id"), servletRequest.getServletRequest());
        }
        return body;
    }

    private void enforceFamilyScope(Object requestedFamilyIdValue, HttpServletRequest request) {
        String requestedFamilyId = String.valueOf(requestedFamilyIdValue == null ? "" : requestedFamilyIdValue).trim();
        if (requestedFamilyId.isBlank()) {
            return;
        }

        String token = SessionTokenCodec.extract(request, properties);
        if (token.isBlank()) {
            if (properties.familyScopeSessionRequired) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "session token is required");
            }
            return;
        }

        Map<String, Object> session = SessionTokenCodec.verify(token, properties, mapper);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid session token");
        }

        if ("admin".equals(String.valueOf(session.get("role")))) {
            return;
        }

        String sessionFamilyId = String.valueOf(session.getOrDefault("family_id", "")).trim();
        if (!requestedFamilyId.equals(sessionFamilyId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "family scope mismatch");
        }
    }
}
