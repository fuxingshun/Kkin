package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Service staff certification application submitted from the miniapp.")
public record ServiceCertificationSubmitRequest(
    @Schema(description = "WeChat openid used to bind the service identity.", example = "wx_service_001")
    @NotBlank(message = "openid is required")
    @Size(max = 191, message = "openid must be at most 191 characters")
    String openid,

    @Schema(description = "Applicant name.", example = "张护工")
    @NotBlank(message = "name is required")
    @Size(max = 191, message = "name must be at most 191 characters")
    String name,

    @Schema(description = "Applicant phone number.", example = "13900000000")
    @NotBlank(message = "phone is required")
    @Size(max = 64, message = "phone must be at most 64 characters")
    String phone,

    @JsonProperty("staff_no")
    @Schema(description = "Staff number in the service organization.", example = "S001")
    @NotBlank(message = "staff_no is required")
    @Size(max = 191, message = "staff_no must be at most 191 characters")
    String staffNo,

    @Schema(description = "Service organization name.", example = "KinEcho Care")
    @NotBlank(message = "organization is required")
    @Size(max = 191, message = "organization must be at most 191 characters")
    String organization
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("openid", openid);
        data.put("name", name);
        data.put("phone", phone);
        data.put("staff_no", staffNo);
        data.put("organization", organization);
        return data;
    }
}
