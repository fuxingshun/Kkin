package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update an elderly care schedule status.")
public record ScheduleStatusRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used for authorization.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Next schedule status.", example = "completed", allowableValues = {"pending", "completed", "skipped", "missed"})
    @NotBlank(message = "status is required")
    @Pattern(regexp = "pending|completed|skipped|missed", message = "invalid status")
    String status,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly id used for audit context.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("status", status);
        putIfPresent(data, "elderly_id", elderlyId);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
