package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Record an elderly media play event.")
public record MediaPlayRecordRequest(
    @JsonProperty("elderly_id")
    @Schema(description = "Elderly user id.", example = "7")
    @NotNull(message = "elderly_id is required")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("duration_watched")
    @Schema(description = "Watched duration in seconds.", example = "120")
    @Min(value = 0, message = "duration_watched must be non-negative")
    Integer durationWatched,

    @Schema(description = "Whether playback completed. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "completed must be 0 or 1")
    @Max(value = 1, message = "completed must be 0 or 1")
    Integer completed,

    @JsonProperty("triggered_by")
    @Schema(description = "Playback trigger source.", example = "manual")
    @Size(max = 64, message = "triggered_by must be at most 64 characters")
    String triggeredBy,

    @JsonProperty("mood_before")
    @Schema(description = "Optional mood before playback.", example = "sad")
    @Size(max = 64, message = "mood_before must be at most 64 characters")
    String moodBefore,

    @JsonProperty("mood_after")
    @Schema(description = "Optional mood after playback.", example = "calm")
    @Size(max = 64, message = "mood_after must be at most 64 characters")
    String moodAfter
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("elderly_id", elderlyId);
        putIfPresent(data, "duration_watched", durationWatched);
        putIfPresent(data, "completed", completed);
        putIfPresent(data, "triggered_by", triggeredBy);
        putIfPresent(data, "mood_before", moodBefore);
        putIfPresent(data, "mood_after", moodAfter);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
