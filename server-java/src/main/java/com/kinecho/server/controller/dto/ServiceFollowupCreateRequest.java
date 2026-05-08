package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a service follow-up consultation task.")
public record ServiceFollowupCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the follow-up.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Target elderly user id.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("counselor_id")
    @Schema(description = "Optional assigned counselor id.", example = "3")
    @Positive(message = "counselor_id must be positive")
    Long counselorId,

    @JsonProperty("consultation_type")
    @Schema(description = "Follow-up channel.", example = "phone", allowableValues = {"phone", "video", "text"})
    @Pattern(regexp = "phone|video|text", message = "consultation_type must be phone, video or text")
    String consultationType,

    @JsonProperty("scheduled_time")
    @Schema(description = "Scheduled time in backend local date-time format.", example = "2026-05-08 10:00:00")
    @NotBlank(message = "scheduled_time is required")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime,

    @Schema(description = "Planned duration in minutes.", example = "30")
    @Positive(message = "duration must be positive")
    Integer duration,

    @Schema(description = "Initial consultation status.", example = "scheduled", allowableValues = {"scheduled", "in_progress", "completed", "cancelled"})
    @Pattern(regexp = "scheduled|in_progress|completed|cancelled", message = "invalid status")
    String status,

    @Schema(description = "Service note visible in the care workflow.", example = "电话回访睡眠情况")
    @Size(max = 1000, message = "note must be at most 1000 characters")
    String note
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("elderly_id", elderlyId);
        putIfPresent(data, "counselor_id", counselorId);
        putIfPresent(data, "consultation_type", consultationType);
        data.put("scheduled_time", scheduledTime);
        putIfPresent(data, "duration", duration);
        putIfPresent(data, "status", status);
        putIfPresent(data, "note", note);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
