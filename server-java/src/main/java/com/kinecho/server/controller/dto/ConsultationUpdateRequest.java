package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update a family-scoped consultation appointment.")
public record ConsultationUpdateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used to authorize the update.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("consultation_type")
    @Schema(description = "Replacement consultation channel.", example = "video", allowableValues = {"phone", "video", "text"})
    @Pattern(regexp = "phone|video|text", message = "consultation_type must be phone, video or text")
    String consultationType,

    @JsonProperty("scheduled_time")
    @Schema(description = "Optional rescheduled time.", example = "2026-05-08 11:00:00")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime,

    @Schema(description = "Replacement duration in minutes.", example = "45")
    @Positive(message = "duration must be positive")
    Integer duration,

    @Schema(description = "Next consultation status.", example = "scheduled", allowableValues = {"scheduled", "in_progress", "completed", "cancelled"})
    @Pattern(regexp = "scheduled|in_progress|completed|cancelled", message = "invalid status")
    String status,

    @Schema(description = "Consultation note. Required by service rules when cancelling.", example = "改约到下周")
    @Size(max = 1000, message = "note must be at most 1000 characters")
    String note,

    @JsonProperty("cancel_reason")
    @Schema(description = "Legacy cancellation reason fallback.", example = "老人临时有事")
    @Size(max = 1000, message = "cancel_reason must be at most 1000 characters")
    String cancelReason,

    @JsonProperty("counselor_id")
    @Schema(description = "Replacement counselor id.", example = "88")
    @Positive(message = "counselor_id must be positive")
    Long counselorId
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "consultation_type", consultationType);
        putIfPresent(data, "scheduled_time", scheduledTime);
        putIfPresent(data, "duration", duration);
        putIfPresent(data, "status", status);
        putIfPresent(data, "note", note);
        putIfPresent(data, "cancel_reason", cancelReason);
        putIfPresent(data, "counselor_id", counselorId);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
