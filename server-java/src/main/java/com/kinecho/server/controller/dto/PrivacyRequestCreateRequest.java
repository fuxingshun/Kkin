package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Family-side privacy request for export, deletion, or data correction.")
public record PrivacyRequestCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the request.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly user id related to this privacy request.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("request_type")
    @Schema(description = "Privacy workflow type.", example = "delete", allowableValues = {"export", "delete", "correction"})
    @NotBlank(message = "request_type is required")
    @Pattern(regexp = "export|delete|correction", message = "unsupported request_type")
    String requestType,

    @JsonProperty("requested_by")
    @Schema(description = "Requester name or role label.", example = "daughter")
    @Size(max = 191, message = "requested_by must be at most 191 characters")
    String requestedBy,

    @Schema(description = "Human-readable request reason.", example = "pilot exit")
    @Size(max = 1000, message = "reason must be at most 1000 characters")
    String reason,

    @Schema(description = "Optional structured metadata captured by the client.")
    Map<String, Object> metadata
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "elderly_id", elderlyId);
        data.put("request_type", requestType);
        putIfPresent(data, "requested_by", requestedBy);
        putIfPresent(data, "reason", reason);
        putIfPresent(data, "metadata", metadata);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
