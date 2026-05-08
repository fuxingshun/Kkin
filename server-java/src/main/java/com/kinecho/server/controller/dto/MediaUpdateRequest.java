package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Schema(description = "Update family media metadata and recommendation policy.")
public record MediaUpdateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used for authorization.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Media title.", example = "生日照片")
    @Size(max = 255, message = "title must be at most 255 characters")
    String title,

    @Schema(description = "Media description.", example = "去年生日聚会")
    @Size(max = 1000, message = "description must be at most 1000 characters")
    String description,

    @Schema(description = "Search tags.", example = "[\"family\",\"birthday\"]")
    List<String> tags,

    @JsonProperty("time_windows")
    @Schema(description = "Recommendation time windows.", example = "[\"19:00-21:00\"]")
    List<String> timeWindows,

    @Schema(description = "Mood tags used for recommendation.", example = "[\"calm\"]")
    List<String> moods,

    @Schema(description = "Occasion tags used for recommendation.", example = "[\"birthday\"]")
    List<String> occasions,

    @Schema(description = "Cooldown in minutes.", example = "60")
    @Min(value = 0, message = "cooldown must be non-negative")
    Integer cooldown,

    @Schema(description = "Recommendation priority.", example = "5")
    @Min(value = 0, message = "priority must be non-negative")
    Integer priority
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "title", title);
        putIfPresent(data, "description", description);
        putIfPresent(data, "tags", tags);
        putIfPresent(data, "time_windows", timeWindows);
        putIfPresent(data, "moods", moods);
        putIfPresent(data, "occasions", occasions);
        putIfPresent(data, "cooldown", cooldown);
        putIfPresent(data, "priority", priority);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
