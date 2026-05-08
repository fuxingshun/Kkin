package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Update mutable fields on a family-scoped user record.")
public record UserUpdateRequest(
    @JsonProperty("family_id")
    @Schema(description = "Family scope used to authorize the update.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Replacement display name.", example = "王阿姨")
    @Size(max = 191, message = "name must be at most 191 characters")
    String name,

    @Schema(description = "Replacement phone number.", example = "13900000000")
    @Size(max = 64, message = "phone must be at most 64 characters")
    String phone,

    @JsonProperty("updated_by")
    @Schema(description = "Explicit updater recorded for audit compatibility.", example = "admin")
    @Size(max = 191, message = "updated_by must be at most 191 characters")
    String updatedBy,

    @Schema(description = "Operator fallback for updated_by.", example = "admin")
    @Size(max = 191, message = "operator must be at most 191 characters")
    String operator
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("family_id", familyId);
        putIfPresent(data, "name", name);
        putIfPresent(data, "phone", phone);
        putIfPresent(data, "updated_by", updatedBy);
        putIfPresent(data, "operator", operator);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
