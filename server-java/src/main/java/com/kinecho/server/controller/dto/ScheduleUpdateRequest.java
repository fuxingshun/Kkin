package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update a family care schedule or reminder.")
public record ScheduleUpdateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used for authorization.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Schedule title.", example = "晚间用药")
    @Size(max = 255, message = "title must be at most 255 characters")
    String title,

    @Schema(description = "Detailed reminder description.", example = "餐后 30 分钟服药")
    @Size(max = 1000, message = "description must be at most 1000 characters")
    String description,

    @JsonProperty("schedule_type")
    @Schema(description = "Care schedule category.", example = "medication", allowableValues = {"medication", "exercise", "meal", "checkup", "other"})
    @Pattern(regexp = "medication|exercise|meal|checkup|other", message = "invalid schedule_type")
    String scheduleType,

    @JsonProperty("schedule_time")
    @Schema(description = "Schedule time in backend local date-time format.", example = "2026-05-08 20:00:00")
    @Size(max = 64, message = "schedule_time must be at most 64 characters")
    String scheduleTime,

    @JsonProperty("repeat_type")
    @Schema(description = "Repeat cadence.", example = "daily", allowableValues = {"once", "daily", "weekly", "monthly"})
    @Pattern(regexp = "once|daily|weekly|monthly", message = "invalid repeat_type")
    String repeatType,

    @JsonProperty("repeat_days")
    @Schema(description = "Optional repeat day expression kept for existing clients.", example = "1,3,5")
    @Size(max = 191, message = "repeat_days must be at most 191 characters")
    String repeatDays,

    @JsonProperty("auto_remind")
    @Schema(description = "Whether the schedule should generate reminders. Existing API uses 1 or 0.", example = "1")
    @Min(value = 0, message = "auto_remind must be 0 or 1")
    @Max(value = 1, message = "auto_remind must be 0 or 1")
    Integer autoRemind,

    @Schema(description = "Schedule workflow status.", example = "pending", allowableValues = {"pending", "completed", "skipped", "missed"})
    @Pattern(regexp = "pending|completed|skipped|missed", message = "invalid status")
    String status
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "title", title);
        putIfPresent(data, "description", description);
        putIfPresent(data, "schedule_type", scheduleType);
        putIfPresent(data, "schedule_time", scheduleTime);
        putIfPresent(data, "repeat_type", repeatType);
        putIfPresent(data, "repeat_days", repeatDays);
        putIfPresent(data, "auto_remind", autoRemind);
        putIfPresent(data, "status", status);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
