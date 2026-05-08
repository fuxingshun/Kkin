package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Schema(description = "Admin request for updating a KinEcho auth account.")
public record AdminAuthAccountUpdateRequest(
    @JsonProperty("display_name")
    @Schema(description = "New display name.", example = "family daughter")
    @Size(max = 191, message = "display_name must be at most 191 characters")
    String displayName,

    @Schema(description = "Replacement password. Sensitive changes require confirmation.", example = "new-strong-password")
    @Size(min = 12, max = 256, message = "password must be 12 to 256 characters")
    String password,

    @Schema(description = "Replacement permission codes.", example = "[\"family:read\"]")
    List<@Size(max = 128, message = "permission must be at most 128 characters") String> permissions,

    @JsonProperty("organization_id")
    @Schema(description = "Replacement organization scope.", example = "org_1")
    @Size(max = 191, message = "organization_id must be at most 191 characters")
    String organizationId,

    @JsonProperty("family_id")
    @Schema(description = "Replacement family scope.", example = "family_001")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("user_id")
    @Schema(description = "Replacement bound users.id.", example = "9")
    @PositiveOrZero(message = "user_id must be positive or zero")
    Long userId,

    @Schema(description = "Disable or enable the account.", example = "true")
    Boolean disabled,
    @Schema(description = "Unlock a locked account and reset failed login count.", example = "true")
    Boolean unlock,
    @Schema(description = "Explicit confirmation flag for sensitive changes.", example = "true")
    Boolean confirmed,
    @Schema(description = "Alternative confirmation flag for sensitive changes.", example = "true")
    Boolean confirm,

    @Schema(description = "Alternative confirmation token. Use CONFIRM for sensitive changes.", example = "CONFIRM")
    @Size(max = 32, message = "confirmation must be at most 32 characters")
    String confirmation,

    @Schema(description = "Operator recorded in auth audit logs.", example = "security-admin")
    @Size(max = 191, message = "operator must be at most 191 characters")
    String operator
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        putIfPresent(data, "display_name", displayName);
        putIfPresent(data, "password", password);
        putIfPresent(data, "permissions", permissions);
        putIfPresent(data, "organization_id", organizationId);
        putIfPresent(data, "family_id", familyId);
        putIfPresent(data, "user_id", userId);
        putIfPresent(data, "disabled", disabled);
        putIfPresent(data, "unlock", unlock);
        putIfPresent(data, "confirmed", confirmed);
        putIfPresent(data, "confirm", confirm);
        putIfPresent(data, "confirmation", confirmation);
        putIfPresent(data, "operator", operator);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
