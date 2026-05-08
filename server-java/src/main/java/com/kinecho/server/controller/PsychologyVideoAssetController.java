package com.kinecho.server.controller;

import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.service.KinEchoApiService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

@RestController
public class PsychologyVideoAssetController {
    private final KinEchoApiService service;
    private final KinEchoProperties properties;
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    public PsychologyVideoAssetController(KinEchoApiService service, KinEchoProperties properties) {
        this.service = service;
        this.properties = properties;
    }

    @GetMapping("/psychology-videos/{videoId}.mp4")
    public ResponseEntity<StreamingResponseBody> streamVideo(
        @PathVariable String videoId,
        @RequestHeader(value = "Range", required = false) String range
    ) throws IOException, InterruptedException {
        String source = service.psychologyVideoSource(videoId);
        if (source == null || source.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        URI sourceUri;
        try {
            sourceUri = URI.create(source);
        } catch (Exception ignored) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (!isAllowedVideoSource(sourceUri)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        HttpRequest.Builder request = HttpRequest.newBuilder(sourceUri)
            .timeout(Duration.ofSeconds(30))
            .header("User-Agent", "KinEcho/1.0 psychology-video-proxy")
            .GET();

        if (range != null && range.startsWith("bytes=")) {
            request.header("Range", range);
        }

        HttpResponse<InputStream> upstream = http.send(request.build(), HttpResponse.BodyHandlers.ofInputStream());
        int upstreamStatus = upstream.statusCode();
        if (upstreamStatus < 200 || upstreamStatus >= 300) {
            closeQuietly(upstream.body());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.valueOf("video/mp4"));
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        copyHeader(upstream, headers, "content-length", HttpHeaders.CONTENT_LENGTH);
        copyHeader(upstream, headers, "content-range", HttpHeaders.CONTENT_RANGE);

        StreamingResponseBody body = output -> {
            try (InputStream input = upstream.body()) {
                input.transferTo(output);
            }
        };

        HttpStatus status = upstreamStatus == HttpStatus.PARTIAL_CONTENT.value()
            ? HttpStatus.PARTIAL_CONTENT
            : HttpStatus.OK;
        return new ResponseEntity<>(body, headers, status);
    }

    private static void copyHeader(HttpResponse<?> response, HttpHeaders headers, String sourceName, String targetName) {
        response.headers().firstValue(sourceName).ifPresent((value) -> headers.set(targetName, value));
    }

    private boolean isAllowedVideoSource(URI source) {
        String scheme = source.getScheme();
        String host = source.getHost();
        if ((!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
            || host == null
            || host.isBlank()
            || source.getUserInfo() != null) {
            return false;
        }
        if (!hostMatchesAllowlist(host)) {
            return false;
        }
        return !isPrivateOrLocalHost(host);
    }

    private boolean hostMatchesAllowlist(String host) {
        List<String> allowedHosts = properties.psychologyVideoAllowedHosts;
        if (allowedHosts == null || allowedHosts.isEmpty()) {
            return true;
        }
        String normalizedHost = normalizeHost(host);
        return allowedHosts.stream()
            .map(PsychologyVideoAssetController::normalizeHost)
            .filter(value -> !value.isBlank())
            .anyMatch(allowed -> normalizedHost.equals(allowed) || normalizedHost.endsWith("." + allowed));
    }

    private static boolean isPrivateOrLocalHost(String host) {
        String normalized = normalizeHost(host);
        if ("localhost".equals(normalized) || normalized.endsWith(".local")) {
            return true;
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress()
                    || address.isLoopbackAddress()
                    || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress()
                    || address.isMulticastAddress()) {
                    return true;
                }
            }
        } catch (UnknownHostException error) {
            return true;
        }
        return false;
    }

    private static String normalizeHost(String host) {
        String normalized = host == null ? "" : host.trim().toLowerCase(Locale.ROOT);
        while (normalized.endsWith(".")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static void closeQuietly(InputStream input) {
        try {
            input.close();
        } catch (IOException ignored) {
        }
    }
}
