package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a scheduled family message for the elderly side.")
public record FamilyMessageCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the message.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Message content.", example = "今晚记得早点休息")
    @NotBlank(message = "content is required")
    @Size(max = 1000, message = "content must be at most 1000 characters")
    String content,

    @JsonProperty("sender_name")
    @Schema(description = "Sender display name.", example = "小明")
    @NotBlank(message = "sender_name is required")
    @Size(max = 191, message = "sender_name must be at most 191 characters")
    String senderName,

    @JsonProperty("sender_relation")
    @Schema(description = "Sender relation to the elderly user.", example = "儿子")
    @NotBlank(message = "sender_relation is required")
    @Size(max = 191, message = "sender_relation must be at most 191 characters")
    String senderRelation,

    @JsonProperty("scheduled_time")
    @Schema(description = "Scheduled play time in backend local date-time format.", example = "2026-05-08 19:30:00")
    @NotBlank(message = "scheduled_time is required")
    @Size(max = 64, message = "scheduled_time must be at most 64 characters")
    String scheduledTime
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("content", content);
        data.put("sender_name", senderName);
        data.put("sender_relation", senderRelation);
        data.put("scheduled_time", scheduledTime);
        return data;
    }
}
