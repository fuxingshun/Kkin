package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create an elderly or family consultation appointment.")
public record ConsultationCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the consultation.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly user id related to this consultation.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("counselor_id")
    @Schema(description = "Optional counselor id. The backend checks availability and slot conflicts.", example = "88")
    @Positive(message = "counselor_id must be positive")
    Long counselorId,

    @JsonProperty("consultation_type")
    @Schema(description = "Consultation channel.", example = "phone", allowableValues = {"phone", "video", "text"})
    @Pattern(regexp = "phone|video|text", message = "consultation_type must be phone, video or text")
    String consultationType,

    @JsonProperty("scheduled_time")
    @Schema(description = "Scheduled time in backend local date-time format.", example = "2026-05-08 10:00:00")
    @NotBlank(message = "scheduled_time is required")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime,

    @Schema(description = "Planned duration in minutes.", example = "45")
    @Positive(message = "duration must be positive")
    Integer duration,

    @Schema(description = "Initial consultation status.", example = "scheduled", allowableValues = {"scheduled", "in_progress", "completed", "cancelled"})
    @Pattern(regexp = "scheduled|in_progress|completed|cancelled", message = "invalid status")
    String status,

    @Schema(description = "Consultation note.", example = "希望电话沟通睡眠问题")
    @Size(max = 1000, message = "note must be at most 1000 characters")
    String note,

    @JsonProperty("notify_service")
    @Schema(description = "Whether to create a service alert for follow-up.", example = "true")
    Boolean notifyService,

    @JsonProperty("concern_level")
    @Schema(description = "Priority for the generated service alert.", example = "medium")
    @Size(max = 32, message = "concern_level must be at most 32 characters")
    String concernLevel,

    @Schema(description = "Topic copied into the generated service alert.", example = "睡眠咨询")
    @Size(max = 191, message = "topic must be at most 191 characters")
    String topic
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "elderly_id", elderlyId);
        putIfPresent(data, "counselor_id", counselorId);
        putIfPresent(data, "consultation_type", consultationType);
        data.put("scheduled_time", scheduledTime);
        putIfPresent(data, "duration", duration);
        putIfPresent(data, "status", status);
        putIfPresent(data, "note", note);
        putIfPresent(data, "notify_service", notifyService);
        putIfPresent(data, "concern_level", concernLevel);
        putIfPresent(data, "topic", topic);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
