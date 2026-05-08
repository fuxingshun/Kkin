package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update a psychology questionnaire item.")
public record AdminPsychologyQuestionUpdateRequest(
    @Schema(description = "Question text.", example = "最近睡眠怎么样？")
    @Size(max = 1000, message = "question must be at most 1000 characters")
    String question,

    @JsonProperty("sort_order")
    @Schema(description = "Display sort order.", example = "1")
    @Min(value = 0, message = "sort_order must be non-negative")
    Integer sortOrder,

    @JsonProperty("is_active")
    @Schema(description = "Whether the question is active. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "is_active must be 0 or 1")
    @Max(value = 1, message = "is_active must be 0 or 1")
    Integer isActive
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        AdminPsychologyQuestionCreateRequest.putIfPresent(data, "question", question);
        AdminPsychologyQuestionCreateRequest.putIfPresent(data, "sort_order", sortOrder);
        AdminPsychologyQuestionCreateRequest.putIfPresent(data, "is_active", isActive);
        return data;
    }
}
