package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Admin review request for a pending privacy workflow item.")
public record PrivacyRequestReviewRequest(
    @Schema(description = "Next review status.", example = "completed", allowableValues = {"processing", "completed", "rejected"})
    @NotBlank(message = "status is required")
    @Pattern(regexp = "processing|completed|rejected", message = "status must be processing, completed or rejected")
    String status,

    @Schema(description = "Admin or operator who processed the request.", example = "privacy-admin")
    @Size(max = 191, message = "reviewer must be at most 191 characters")
    String reviewer,

    @JsonProperty("process_note")
    @Schema(description = "Processing note. Required by service rules when rejecting.", example = "verified and completed")
    @Size(max = 1000, message = "process_note must be at most 1000 characters")
    String processNote,

    @Schema(description = "Legacy fallback note field accepted by the service.", example = "not enough context")
    @Size(max = 1000, message = "reason must be at most 1000 characters")
    String reason
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", status);
        putIfPresent(data, "reviewer", reviewer);
        putIfPresent(data, "process_note", processNote);
        putIfPresent(data, "reason", reason);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
