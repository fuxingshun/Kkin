package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Submit elderly feedback for a media item.")
public record MediaFeedbackRequest(
    @JsonProperty("elderly_id")
    @Schema(description = "Elderly user id.", example = "7")
    @NotNull(message = "elderly_id is required")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("feedback_type")
    @Schema(description = "Media feedback type.", example = "like", allowableValues = {"like", "dislike"})
    @NotBlank(message = "feedback_type is required")
    @Pattern(regexp = "like|dislike", message = "feedback_type must be like or dislike")
    String feedbackType
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("elderly_id", elderlyId);
        data.put("feedback_type", feedbackType);
        return data;
    }
}
