package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Create a family or elderly user record.")
public record UserCreateRequest(
    @JsonProperty("user_type")
    @Schema(description = "User role in the family archive.", example = "elderly", allowableValues = {"elderly", "family"})
    @NotBlank(message = "user_type is required")
    @Pattern(regexp = "elderly|family", message = "invalid user_type")
    String userType,

    @Schema(description = "Display name.", example = "王阿姨")
    @NotBlank(message = "name is required")
    @Size(max = 191, message = "name must be at most 191 characters")
    String name,

    @Schema(description = "Phone number.", example = "13900000000")
    @Size(max = 64, message = "phone must be at most 64 characters")
    String phone,

    @JsonProperty("family_id")
    @Schema(description = "Family scope for this user.", example = "family_001")
    @NotBlank(message = "family_id is required")
    @Size(max = 191, message = "family_id must be at most 191 characters")
    String familyId,

    @JsonProperty("wechat_openid")
    @Schema(description = "Optional WeChat openid binding.", example = "wx_family_001")
    @Size(max = 191, message = "wechat_openid must be at most 191 characters")
    String wechatOpenid,

    @JsonProperty("created_by")
    @Schema(description = "Explicit creator recorded for audit compatibility.", example = "admin")
    @Size(max = 191, message = "created_by must be at most 191 characters")
    String createdBy,

    @JsonProperty("updated_by")
    @Schema(description = "Explicit updater recorded for audit compatibility.", example = "admin")
    @Size(max = 191, message = "updated_by must be at most 191 characters")
    String updatedBy,

    @Schema(description = "Operator fallback for created_by and updated_by.", example = "admin")
    @Size(max = 191, message = "operator must be at most 191 characters")
    String operator
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("user_type", userType);
        data.put("name", name);
        putIfPresent(data, "phone", phone);
        data.put("family_id", familyId);
        putIfPresent(data, "wechat_openid", wechatOpenid);
        putIfPresent(data, "created_by", createdBy);
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
