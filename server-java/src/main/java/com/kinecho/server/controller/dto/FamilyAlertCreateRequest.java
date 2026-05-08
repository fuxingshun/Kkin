package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a family alert for care follow-up.")
public record FamilyAlertCreateRequest(
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
    @Schema(description = "Alert category.", example = "medication", allowableValues = {"sos_emergency", "contact_family", "medication", "emotion", "inactive", "emergency", "ai_crisis"})
    @NotBlank(message = "alert_type is required")
    @Pattern(regexp = "sos_emergency|contact_family|medication|emotion|inactive|emergency|ai_crisis", message = "invalid alert_type")
    String alertType,

    @Schema(description = "Alert severity.", example = "high", allowableValues = {"low", "medium", "high"})
    @NotBlank(message = "level is required")
    @Pattern(regexp = "low|medium|high", message = "level must be low, medium or high")
    String level,

    @Schema(description = "Optional alert title.", example = "用药提醒")
    @Size(max = 191, message = "title must be at most 191 characters")
    String title,

    @Schema(description = "Alert message shown to family and service staff.", example = "老人尚未完成晚间用药")
    @NotBlank(message = "message is required")
    @Size(max = 1000, message = "message must be at most 1000 characters")
    String message,

    @Schema(description = "Alert source.", example = "elderly", allowableValues = {"elderly", "system", "family", "ai_companion"})
    @Pattern(regexp = "elderly|system|family|ai_companion", message = "invalid source")
    String source,

    @JsonProperty("created_by")
    @Schema(description = "Optional actor name or id kept for audit compatibility.", example = "family")
    @Size(max = 191, message = "created_by must be at most 191 characters")
    String createdBy,

    @Schema(description = "Additional alert metadata.", example = "{\"schedule_id\":12}")
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
        putIfPresent(data, "source", source);
        putIfPresent(data, "created_by", createdBy);
        putIfPresent(data, "metadata", metadata);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
