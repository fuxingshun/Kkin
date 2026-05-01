package com.kinecho.server.controller;

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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@RestController
public class PsychologyVideoAssetController {
    private final KinEchoApiService service;
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    public PsychologyVideoAssetController(KinEchoApiService service) {
        this.service = service;
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

        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(source))
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

    private static void closeQuietly(InputStream input) {
        try {
            input.close();
        } catch (IOException ignored) {
        }
    }
}
