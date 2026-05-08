package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Advance or cancel a service follow-up consultation.")
public record ServiceFollowupStatusRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used to authorize the follow-up update.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Next consultation status.", example = "completed", allowableValues = {"scheduled", "in_progress", "completed", "cancelled"})
    @NotBlank(message = "status is required")
    @Pattern(regexp = "scheduled|in_progress|completed|cancelled", message = "invalid status")
    String status,

    @JsonProperty("scheduled_time")
    @Schema(description = "Optional rescheduled time for scheduled consultations.", example = "2026-05-08 11:00:00")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime,

    @Schema(description = "Lifecycle note. Required by service rules when cancelling.", example = "家属要求改约")
    @Size(max = 1000, message = "note must be at most 1000 characters")
    String note,

    @JsonProperty("cancel_reason")
    @Schema(description = "Legacy cancellation reason fallback.", example = "老人临时有事")
    @Size(max = 1000, message = "cancel_reason must be at most 1000 characters")
    String cancelReason
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("status", status);
        putIfPresent(data, "scheduled_time", scheduledTime);
        putIfPresent(data, "note", note);
        putIfPresent(data, "cancel_reason", cancelReason);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
