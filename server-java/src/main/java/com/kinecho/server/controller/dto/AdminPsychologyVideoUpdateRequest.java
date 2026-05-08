package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Schema(description = "Update a psychology encyclopedia video.")
public record AdminPsychologyVideoUpdateRequest(
    @Schema(description = "Stable video slug.", example = "sleep-care")
    @Size(max = 191, message = "slug must be at most 191 characters")
    String slug,

    @Schema(description = "Video title.", example = "睡眠照护练习")
    @Size(max = 255, message = "title must be at most 255 characters")
    String title,

    @Schema(description = "Content category.", example = "睡眠")
    @Size(max = 191, message = "category must be at most 191 characters")
    String category,

    @Schema(description = "Display duration.", example = "5 分钟")
    @Size(max = 64, message = "duration must be at most 64 characters")
    String duration,

    @Schema(description = "Speaker name.", example = "心理咨询师")
    @Size(max = 191, message = "speaker must be at most 191 characters")
    String speaker,

    @Schema(description = "Video summary.", example = "帮助老人建立睡前放松习惯")
    @Size(max = 1000, message = "summary must be at most 1000 characters")
    String summary,

    @JsonProperty("poster_url")
    @Schema(description = "Poster URL.", example = "https://example.com/poster.jpg")
    @Size(max = 1000, message = "poster_url must be at most 1000 characters")
    String posterUrl,

    @JsonProperty("source_url")
    @Schema(description = "Playable source URL.", example = "https://example.com/video.mp4")
    @Size(max = 1000, message = "source_url must be at most 1000 characters")
    String sourceUrl,

    @Schema(description = "License or attribution text.", example = "pilot")
    @Size(max = 191, message = "license must be at most 191 characters")
    String license,

    @JsonProperty("cover_class_name")
    @Schema(description = "Miniapp cover style class.", example = "sleep")
    @Size(max = 191, message = "cover_class_name must be at most 191 characters")
    String coverClassName,

    @Schema(description = "Key takeaways.", example = "[\"固定睡眠时间\",\"减少睡前刺激\"]")
    List<String> takeaways,

    @JsonProperty("sort_order")
    @Schema(description = "Display sort order.", example = "1")
    @Min(value = 0, message = "sort_order must be non-negative")
    Integer sortOrder,

    @JsonProperty("is_active")
    @Schema(description = "Whether the video is active. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "is_active must be 0 or 1")
    @Max(value = 1, message = "is_active must be 0 or 1")
    Integer isActive
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "slug", slug);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "title", title);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "category", category);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "duration", duration);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "speaker", speaker);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "summary", summary);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "poster_url", posterUrl);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "source_url", sourceUrl);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "license", license);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "cover_class_name", coverClassName);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "takeaways", takeaways);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "sort_order", sortOrder);
        AdminPsychologyVideoCreateRequest.putIfPresent(data, "is_active", isActive);
        return data;
    }
}
