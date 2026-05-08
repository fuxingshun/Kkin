package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Record a privacy or product consent decision.")
public record ConsentRecordCreateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope for the consent record.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("elderly_id")
    @Schema(description = "Optional elderly user id related to the consent.", example = "7")
    @Positive(message = "elderly_id must be positive")
    Long elderlyId,

    @JsonProperty("user_id")
    @Schema(description = "Optional actor user id.", example = "12")
    @Positive(message = "user_id must be positive")
    Long userId,

    @JsonProperty("consent_type")
    @Schema(description = "Consent type or policy name.", example = "privacy-policy")
    @NotBlank(message = "consent_type is required")
    @Size(max = 191, message = "consent_type must be at most 191 characters")
    String consentType,

    @Schema(description = "Policy version accepted or rejected.", example = "v1")
    @NotBlank(message = "version is required")
    @Size(max = 64, message = "version must be at most 64 characters")
    String version,

    @Schema(description = "Whether the actor accepted the consent.", example = "true")
    Boolean accepted,

    @JsonProperty("actor_role")
    @Schema(description = "Actor role used for audit records.", example = "family")
    @Size(max = 64, message = "actor_role must be at most 64 characters")
    String actorRole,

    @JsonProperty("actor_name")
    @Schema(description = "Actor display name used for audit records.", example = "小明")
    @Size(max = 191, message = "actor_name must be at most 191 characters")
    String actorName,

    @Schema(description = "Consent source channel.", example = "miniapp")
    @Size(max = 64, message = "source must be at most 64 characters")
    String source,

    @Schema(description = "Additional consent metadata.", example = "{\"scene\":\"onboarding\"}")
    Map<String, Object> metadata
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "elderly_id", elderlyId);
        putIfPresent(data, "user_id", userId);
        data.put("consent_type", consentType);
        data.put("version", version);
        putIfPresent(data, "accepted", accepted);
        putIfPresent(data, "actor_role", actorRole);
        putIfPresent(data, "actor_name", actorName);
        putIfPresent(data, "source", source);
        putIfPresent(data, "metadata", metadata);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
