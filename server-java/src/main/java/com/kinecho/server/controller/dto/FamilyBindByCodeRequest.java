package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Bind a family user to an elderly account with a binding code.")
public record FamilyBindByCodeRequest(
    @JsonProperty("binding_code")
    @Schema(description = "Elderly binding code.", example = "AB12CD34")
    @NotBlank(message = "binding_code is required")
    @Pattern(regexp = "[A-Za-z0-9]{6,16}", message = "binding_code must be 6 to 16 letters or digits")
    String bindingCode,

    @Schema(description = "Family member display name.", example = "女儿")
    @NotBlank(message = "name is required")
    @Size(max = 191, message = "name must be at most 191 characters")
    String name,

    @Schema(description = "Optional phone number for matching an existing family user.", example = "13900000000")
    @Size(max = 32, message = "phone must be at most 32 characters")
    String phone,

    @JsonProperty("wechat_openid")
    @Schema(description = "Optional WeChat OpenID to attach to the family user.", example = "openid_xxx")
    @Size(max = 191, message = "wechat_openid must be at most 191 characters")
    String wechatOpenid,

    @Schema(description = "Operator value used for audit compatibility.", example = "family")
    @Size(max = 64, message = "operator must be at most 64 characters")
    String operator
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("binding_code", bindingCode);
        data.put("name", name);
        putIfPresent(data, "phone", phone);
        putIfPresent(data, "wechat_openid", wechatOpenid);
        putIfPresent(data, "operator", operator);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
