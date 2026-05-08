package com.kinecho.server.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException error) {
        List<Map<String, Object>> details = error.getBindingResult().getFieldErrors().stream()
            .map(ApiExceptionHandler::validationDetail)
            .toList();
        String message = details.isEmpty()
            ? "request validation failed"
            : String.valueOf(details.get(0).get("message"));
        return badRequest("VALIDATION_ERROR", message, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody() {
        return badRequest("INVALID_JSON", "request body is not readable", List.of());
    }

    private static Map<String, Object> validationDetail(FieldError error) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("field", error.getField());
        detail.put("message", error.getDefaultMessage());
        return detail;
    }

    private static ResponseEntity<Map<String, Object>> badRequest(String code, String message, List<Map<String, Object>> details) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("code", code);
        body.put("message", message);
        body.put("request_id", UUID.randomUUID().toString());
        if (!details.isEmpty()) {
            body.put("details", details);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
