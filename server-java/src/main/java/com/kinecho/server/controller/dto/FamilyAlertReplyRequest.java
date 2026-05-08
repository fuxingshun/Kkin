package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Reply to a family alert.")
public record FamilyAlertReplyRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used for authorization.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("reply_message")
    @Schema(description = "Reply shown to the elderly side.", example = "马上联系你")
    @NotBlank(message = "reply_message is required")
    @Size(max = 1000, message = "reply_message must be at most 1000 characters")
    String replyMessage
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        data.put("reply_message", replyMessage);
        return data;
    }
}
