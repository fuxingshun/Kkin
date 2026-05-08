package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a completed service record and optionally close a family alert.")
public record ServiceRecordCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the service record.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Target elderly user id.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("alert_id")
    @Schema(description = "Optional alert id to mark handled.", example = "55")
    @PositiveOrZero(message = "alert_id must be positive or zero")
    Long alertId,

    @JsonProperty("counselor_id")
    @Schema(description = "Optional counselor id.", example = "3")
    @Positive(message = "counselor_id must be positive")
    Long counselorId,

    @Schema(description = "Service record content.", example = "已电话回访，老人状态平稳")
    @NotBlank(message = "content is required")
    @Size(max = 2000, message = "content must be at most 2000 characters")
    String content,

    @JsonProperty("scheduled_time")
    @Schema(description = "Optional record time. Defaults to backend current time when omitted.", example = "2026-05-08 10:00:00")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime,

    @Schema(description = "Service duration in minutes.", example = "15")
    @Positive(message = "duration must be positive")
    Integer duration
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("elderly_id", elderlyId);
        putIfPresent(data, "alert_id", alertId);
        putIfPresent(data, "counselor_id", counselorId);
        data.put("content", content);
        putIfPresent(data, "scheduled_time", scheduledTime);
        putIfPresent(data, "duration", duration);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
