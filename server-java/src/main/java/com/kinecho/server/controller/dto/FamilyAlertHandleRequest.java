package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Mark a family alert as handled.")
public record FamilyAlertHandleRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used for authorization.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("handled_by")
    @Schema(description = "Optional handler user id.", example = "3")
    @Positive(message = "handled_by must be positive")
    Long handledBy,

    @JsonProperty("reply_message")
    @Schema(description = "Optional handling note or reply.", example = "已电话确认")
    @Size(max = 1000, message = "reply_message must be at most 1000 characters")
    String replyMessage
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "handled_by", handledBy);
        putIfPresent(data, "reply_message", replyMessage);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
