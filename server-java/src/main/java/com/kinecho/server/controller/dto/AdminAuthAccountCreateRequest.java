package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Schema(description = "Admin request for creating a database-backed KinEcho auth account.")
public record AdminAuthAccountCreateRequest(
    @Schema(description = "Account role.", example = "family", allowableValues = {"admin", "service", "counselor", "family", "elderly"})
    @NotBlank(message = "role is required")
    @Pattern(regexp = "admin|service|counselor|family|elderly", message = "invalid role")
    String role,

    @Schema(description = "Unique login username.", example = "daughter")
    @NotBlank(message = "username is required")
    @Size(max = 191, message = "username must be at most 191 characters")
    String username,

    @Schema(description = "Initial password. Must be at least 12 characters.", example = "family-strong-password")
    @NotBlank(message = "password is required")
    @Size(min = 12, max = 256, message = "password must be 12 to 256 characters")
    String password,

    @JsonProperty("display_name")
    @Schema(description = "Human-readable display name.", example = "family daughter")
    @Size(max = 191, message = "display_name must be at most 191 characters")
    String displayName,

    @Schema(description = "Permission codes. Defaults to role-wide permission when omitted.", example = "[\"family:read\"]")
    List<@Size(max = 128, message = "permission must be at most 128 characters") String> permissions,

    @JsonProperty("user_id")
    @Schema(description = "Bound users.id for family or elderly accounts.", example = "9")
    @PositiveOrZero(message = "user_id must be positive or zero")
    Long userId,

    @JsonProperty("organization_id")
    @Schema(description = "Organization scope for service or admin accounts.", example = "org_1")
    @Size(max = 191, message = "organization_id must be at most 191 characters")
    String organizationId,

    @JsonProperty("family_id")
    @Schema(description = "Family scope for family, elderly, or delegated service accounts.", example = "family_001")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @Schema(description = "Whether the account starts disabled.", example = "false")
    Boolean disabled,

    @Schema(description = "Operator recorded in auth audit logs.", example = "admin")
    @Size(max = 191, message = "operator must be at most 191 characters")
    String operator
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("role", role);
        data.put("username", username);
        data.put("password", password);
        putIfPresent(data, "display_name", displayName);
        putIfPresent(data, "permissions", permissions);
        putIfPresent(data, "user_id", userId);
        putIfPresent(data, "organization_id", organizationId);
        putIfPresent(data, "family_id", familyId);
        putIfPresent(data, "disabled", disabled);
        putIfPresent(data, "operator", operator);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
