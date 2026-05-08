package com.kinecho.server.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

@Schema(description = "Admin review request for a service staff certification application.")
public record ServiceCertificationReviewRequest(
    @Schema(description = "Review decision.", example = "approved", allowableValues = {"approved", "rejected"})
    @NotBlank(message = "status is required")
    @Pattern(regexp = "approved|rejected", message = "status must be approved or rejected")
    String status,

    @Schema(description = "Reviewer name or operator id.", example = "admin")
    @Size(max = 191, message = "reviewer must be at most 191 characters")
    String reviewer,

    @JsonProperty("reject_reason")
    @Schema(description = "Reason for rejection. Required by service rules when status is rejected.", example = "证件信息不完整")
    @Size(max = 1000, message = "reject_reason must be at most 1000 characters")
    String rejectReason,

    @Schema(description = "Legacy fallback rejection reason accepted by the service.", example = "证件信息不完整")
    @Size(max = 1000, message = "reason must be at most 1000 characters")
    String reason
) {
    public Map<String, Object> toMap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", status);
        putIfPresent(data, "reviewer", reviewer);
        putIfPresent(data, "reject_reason", rejectReason);
        putIfPresent(data, "reason", reason);
        return data;
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null) {
            data.put(key, value);
        }
    }
}
