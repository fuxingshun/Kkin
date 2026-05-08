package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update counselor availability and scheduling metadata.")
public record AdminCounselorUpdateRequest(
    @Schema(description = "Whether the counselor accepts bookings. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "available must be 0 or 1")
    @Max(value = 1, message = "available must be 0 or 1")
    Integer available,

    @JsonProperty("is_active")
    @Schema(description = "Whether the counselor is active. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "is_active must be 0 or 1")
    @Max(value = 1, message = "is_active must be 0 or 1")
    Integer isActive,

    @JsonProperty("availability_text")
    @Schema(description = "Human readable availability text.", example = "试点期间可预约")
    @Size(max = 1000, message = "availability_text must be at most 1000 characters")
    String availabilityText,

    @Schema(description = "Structured calendar metadata.", example = "{\"weekday\":[\"19:00\"]}")
    Map<String, Object> calendar
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        putIfPresent(data, "available", available);
        putIfPresent(data, "is_active", isActive);
        putIfPresent(data, "availability_text", availabilityText);
        putIfPresent(data, "calendar", calendar);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
