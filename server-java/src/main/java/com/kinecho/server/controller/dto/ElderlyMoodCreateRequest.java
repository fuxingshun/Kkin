package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a mood record from the elderly side.")
public record ElderlyMoodCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the mood record.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly user id related to the mood record.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("mood_type")
    @Schema(description = "Mood category.", example = "calm", allowableValues = {"happy", "calm", "sad", "anxious", "angry", "tired"})
    @NotBlank(message = "mood_type is required")
    @Pattern(regexp = "happy|calm|sad|anxious|angry|tired", message = "invalid mood_type")
    String moodType,

    @JsonProperty("mood_score")
    @Schema(description = "Mood score from 1 to 10.", example = "8")
    @Min(value = 1, message = "mood_score must be 1-10")
    @Max(value = 10, message = "mood_score must be 1-10")
    Integer moodScore,

    @Schema(description = "Optional mood note.", example = "今天状态不错")
    @Size(max = 1000, message = "note must be at most 1000 characters")
    String note,

    @Schema(description = "Record source.", example = "manual")
    @Size(max = 64, message = "source must be at most 64 characters")
    String source,

    @JsonProperty("trigger_event")
    @Schema(description = "Optional trigger event.", example = "morning_checkin")
    @Size(max = 191, message = "trigger_event must be at most 191 characters")
    String triggerEvent,

    @Schema(description = "Optional location.", example = "home")
    @Size(max = 191, message = "location must be at most 191 characters")
    String location,

    @Schema(description = "Optional weather context.", example = "sunny")
    @Size(max = 191, message = "weather must be at most 191 characters")
    String weather,

    @JsonProperty("recorded_at")
    @Schema(description = "Recorded time in backend local date-time format.", example = "2026-05-08 09:30:00")
    @Size(max = 64, message = "recorded_at must be at most 64 characters")
    String recordedAt
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "elderly_id", elderlyId);
        data.put("mood_type", moodType);
        putIfPresent(data, "mood_score", moodScore);
        putIfPresent(data, "note", note);
        putIfPresent(data, "source", source);
        putIfPresent(data, "trigger_event", triggerEvent);
        putIfPresent(data, "location", location);
        putIfPresent(data, "weather", weather);
        putIfPresent(data, "recorded_at", recordedAt);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
