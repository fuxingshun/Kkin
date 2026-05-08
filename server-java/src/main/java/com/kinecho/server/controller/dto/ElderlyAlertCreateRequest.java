package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create an elderly-originated alert for family follow-up.")
public record ElderlyAlertCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the alert.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly user id related to the alert.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("alert_type")
    @Schema(description = "Alert category.", example = "sos_emergency", allowableValues = {"sos_emergency", "contact_family", "medication", "emotion", "inactive", "emergency", "ai_crisis"})
    @NotBlank(message = "alert_type is required")
    @Pattern(regexp = "sos_emergency|contact_family|medication|emotion|inactive|emergency|ai_crisis", message = "invalid alert_type")
    String alertType,

    @Schema(description = "Alert severity.", example = "high", allowableValues = {"low", "medium", "high"})
    @NotBlank(message = "level is required")
    @Pattern(regexp = "low|medium|high", message = "level must be low, medium or high")
    String level,

    @Schema(description = "Optional alert title.", example = "紧急求助")
    @Size(max = 191, message = "title must be at most 191 characters")
    String title,

    @Schema(description = "Alert message.", example = "我需要帮助")
    @NotBlank(message = "message is required")
    @Size(max = 1000, message = "message must be at most 1000 characters")
    String message,

    @Schema(description = "Additional alert metadata.", example = "{\"button\":\"sos\"}")
    Map<String, Object> metadata
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "elderly_id", elderlyId);
        data.put("alert_type", alertType);
        data.put("level", level);
        putIfPresent(data, "title", title);
        data.put("message", message);
        putIfPresent(data, "metadata", metadata);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
