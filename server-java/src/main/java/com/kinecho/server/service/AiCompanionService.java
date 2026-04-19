package com.kinecho.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.entity.AiInteraction;
import com.kinecho.server.mapper.AiInteractionMapper;
import com.kinecho.server.mapper.KinEchoMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiCompanionService {
    private final KinEchoMapper db;
    private final AiInteractionMapper aiInteractionMapper;
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public AiCompanionService(
        KinEchoMapper db,
        AiInteractionMapper aiInteractionMapper,
        KinEchoProperties properties,
        ObjectMapper mapper
    ) throws IOException {
        this.db = db;
        this.aiInteractionMapper = aiInteractionMapper;
        this.properties = properties;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
        Files.createDirectories(properties.aiAudioDir);
        Files.createDirectories(properties.aiVoiceUploadDir);
    }

    public List<Map<String, Object>> getInteractionHistory(String username, int limit) {
        String user = normalizeUser(username);
        int normalizedLimit = Math.max(1, Math.min(limit, 500));
        List<AiInteraction> rows = aiInteractionMapper.selectList(new LambdaQueryWrapper<AiInteraction>()
            .eq(AiInteraction::getUsername, user)
            .orderByDesc(AiInteraction::getCreatetime)
            .orderByDesc(AiInteraction::getId)
            .last("LIMIT " + normalizedLimit));
        List<Map<String, Object>> messages = new ArrayList<>();
        for (AiInteraction row : rows) {
            String content = db.string(row.getContent()).trim();
            if (content.isBlank()) {
                continue;
            }
            messages.add(db.map(
                "id", row.getId(),
                "username", row.getUsername(),
                "type", row.getType(),
                "way", row.getWay(),
                "content", content,
                "createtime", row.getCreatetime(),
                "timetext", row.getTimetext(),
                "is_adopted", 0
            ));
        }
        return messages;
    }

    public long clearInteractions(String username) {
        if (username == null || username.isBlank()) {
            return aiInteractionMapper.delete(null);
        }
        return aiInteractionMapper.delete(new LambdaQueryWrapper<AiInteraction>()
            .eq(AiInteraction::getUsername, username.trim()));
    }

    public Map<String, Object> chat(String message, String user, String origin) {
        String content = message == null ? "" : message.trim();
        if (content.isBlank()) {
            throw new IllegalArgumentException("missing message");
        }
        String username = normalizeUser(user);
        recordInteraction("member", content, username, "text");

        String reply;
        String chatProvider = "bailian";
        String providerError = "";
        try {
            reply = callBailianChat(content);
        } catch (Exception ex) {
            providerError = ex.getMessage();
            chatProvider = "local";
            reply = localReply(content);
        }
        reply = sanitizeReply(reply);
        recordInteraction("ai", reply, username, "text");

        SpeechResult speech = synthesizeSpeech(reply, origin);
        return db.map(
            "success", true,
            "message", content,
            "reply", reply,
            "chat_provider", chatProvider,
            "provider_error", providerError == null ? "" : providerError,
            "audio_url", speech.url,
            "audio_error", speech.error,
            "tts_provider", speech.provider
        );
    }

    public Map<String, Object> voiceChat(MultipartFile file, String user, String origin) throws IOException {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()) {
            throw new IllegalArgumentException("missing voice file");
        }
        String ext = extension(file.getOriginalFilename(), "mp3");
        if (!List.of("mp3", "aac", "m4a", "wav", "webm", "ogg", "flac").contains(ext)) {
            throw new IllegalArgumentException("unsupported voice format: " + ext);
        }
        Path target = properties.aiVoiceUploadDir.resolve("voice-" + Instant.now().toEpochMilli() + "." + ext);
        file.transferTo(target);

        TranscriptionResult transcription = transcribeAudio(target, origin);
        if (transcription.text.isBlank()) {
            return db.map(
                "error", "voice was not recognized",
                "asr_error", transcription.error,
                "asr_provider", transcription.provider
            );
        }

        Map<String, Object> result = chat(transcription.text, user, origin);
        result.put("transcript", transcription.text);
        result.put("asr_provider", transcription.provider);
        result.put("asr_error", transcription.error);
        return result;
    }

    public Map<String, Object> speak(String text, String user, String origin) {
        String content = text == null ? "" : text.trim();
        if (content.isBlank()) {
            throw new IllegalArgumentException("missing text");
        }
        SpeechResult speech = synthesizeSpeech(content, origin);
        return db.map(
            "success", true,
            "audio_url", speech.url,
            "audio_error", speech.error,
            "tts_provider", speech.provider
        );
    }

    private String callBailianChat(String message) throws Exception {
        assertBailianApiKey();
        Map<String, Object> payload = db.map(
            "model", properties.bailianChatModel,
            "messages", List.of(
                db.map("role", "system", "content", properties.bailianSystemPrompt),
                db.map("role", "user", "content", message)
            ),
            "stream", false,
            "temperature", properties.bailianChatTemperature
        );
        if (properties.bailianChatMaxTokens > 0) {
            payload.put("max_tokens", properties.bailianChatMaxTokens);
        }
        Map<String, Object> response = postJson(
            properties.bailianCompatibleBaseUrl + "/chat/completions",
            payload,
            bearer(properties.bailianApiKey),
            properties.bailianChatTimeoutSeconds
        );
        return extractChatReply(response);
    }

    private TranscriptionResult transcribeAudio(Path file, String origin) {
        try {
            assertBailianApiKey();
            String fileUrl = bailianVoiceFileUrl(file, origin);
            Map<String, Object> payload = db.map(
                "model", properties.bailianAsrModel,
                "input", db.map("file_urls", List.of(fileUrl))
            );
            if (properties.bailianAsrLanguageHints != null && !properties.bailianAsrLanguageHints.isEmpty()) {
                payload.put("parameters", db.map("language_hints", properties.bailianAsrLanguageHints));
            }
            Map<String, Object> submitted = postJson(
                properties.bailianApiBaseUrl + "/services/audio/asr/transcription",
                payload,
                bearer(properties.bailianApiKey),
                properties.bailianAsrTimeoutSeconds,
                Map.of("X-DashScope-Async", "enable")
            );
            String taskId = nestedString(submitted, "output", "task_id");
            if (taskId.isBlank()) {
                return new TranscriptionResult("", "Bailian ASR did not return task_id: " + compactJson(submitted), "bailian");
            }
            return pollBailianAsrTask(taskId);
        } catch (Exception ex) {
            return new TranscriptionResult("", ex.getMessage(), "bailian");
        }
    }

    private TranscriptionResult pollBailianAsrTask(String taskId) throws Exception {
        long deadline = System.currentTimeMillis() + Math.max(1, properties.bailianAsrTimeoutSeconds) * 1000L;
        Map<String, Object> latest = new LinkedHashMap<>();
        while (System.currentTimeMillis() < deadline) {
            latest = getJson(
                properties.bailianApiBaseUrl + "/tasks/" + taskId,
                bearer(properties.bailianApiKey),
                properties.bailianAsrTimeoutSeconds
            );
            String status = nestedString(latest, "output", "task_status").toUpperCase();
            if ("SUCCEEDED".equals(status)) {
                String text = extractAsrText(latest);
                return new TranscriptionResult(text, text.isBlank() ? "Bailian ASR succeeded but returned no text: " + compactJson(latest) : "", "bailian");
            }
            if ("FAILED".equals(status) || "CANCELED".equals(status) || "UNKNOWN".equals(status)) {
                return new TranscriptionResult("", "Bailian ASR task " + status + ": " + compactJson(latest), "bailian");
            }
            Thread.sleep(Math.max(200, properties.bailianAsrPollIntervalMillis));
        }
        return new TranscriptionResult("", "Bailian ASR task timed out: " + compactJson(latest), "bailian");
    }

    private String extractAsrText(Map<String, Object> taskPayload) throws Exception {
        String direct = firstNonBlank(
            nestedString(taskPayload, "output", "text"),
            nestedString(taskPayload, "output", "transcription"),
            nestedString(taskPayload, "output", "sentence")
        );
        if (!direct.isBlank()) {
            return direct;
        }
        Object output = taskPayload.get("output");
        if (!(output instanceof Map<?, ?> outputMap)) {
            return "";
        }
        Object results = outputMap.get("results");
        if (!(results instanceof List<?> list)) {
            return "";
        }
        List<String> texts = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> result) {
                String text = firstNonBlank(
                    mapString(result, "text"),
                    mapString(result, "transcription"),
                    mapString(result, "sentence")
                );
                if (!text.isBlank()) {
                    texts.add(text);
                }
                String transcriptionUrl = firstNonBlank(
                    mapString(result, "transcription_url"),
                    mapString(result, "transcriptionUrl"),
                    mapString(result, "url")
                );
                if (!transcriptionUrl.isBlank()) {
                    Map<String, Object> transcription = getJson(transcriptionUrl, "", properties.bailianAsrTimeoutSeconds);
                    String extracted = extractTextFromTranscriptionJson(transcription);
                    if (!extracted.isBlank()) {
                        texts.add(extracted);
                    }
                }
            }
        }
        return String.join("", texts).trim();
    }

    private String extractTextFromTranscriptionJson(Object value) {
        List<String> texts = new ArrayList<>();
        collectTextValues(value, texts);
        return String.join("", texts).trim();
    }

    private void collectTextValues(Object value, List<String> texts) {
        if (value instanceof Map<?, ?> map) {
            for (String key : List.of("text", "transcript", "transcription")) {
                Object text = map.get(key);
                if (text != null && !text.toString().trim().isBlank()) {
                    texts.add(text.toString().trim());
                }
            }
            for (Object child : map.values()) {
                collectTextValues(child, texts);
            }
        } else if (value instanceof List<?> list) {
            for (Object item : list) {
                collectTextValues(item, texts);
            }
        }
    }

    private SpeechResult synthesizeSpeech(String text, String origin) {
        try {
            assertBailianApiKey();
            Map<String, Object> payload = db.map(
                "model", properties.bailianTtsModel,
                "input", db.map(
                    "text", text,
                    "voice", properties.bailianTtsVoice,
                    "language_type", properties.bailianTtsLanguageType
                )
            );
            Map<String, Object> response = postJson(
                properties.bailianApiBaseUrl + "/services/aigc/multimodal-generation/generation",
                payload,
                bearer(properties.bailianApiKey),
                properties.bailianTtsTimeoutSeconds
            );
            String audioUrl = nestedString(response, "output", "audio", "url");
            if (audioUrl.isBlank()) {
                return new SpeechResult("", "Bailian TTS did not return audio url: " + compactJson(response), "bailian");
            }
            byte[] audio = downloadBytes(audioUrl, properties.bailianTtsTimeoutSeconds);
            String format = properties.bailianTtsFileExtension.isBlank() ? "wav" : properties.bailianTtsFileExtension;
            String filename = "ai-" + Instant.now().toEpochMilli() + "." + format;
            Path target = properties.aiAudioDir.resolve(filename);
            Files.write(target, audio);
            pruneAudioFiles();
            return new SpeechResult(absoluteAssetUrl(origin, "uploads/ai-audio/" + filename), "", "bailian");
        } catch (Exception ex) {
            return new SpeechResult("", ex.getMessage(), "bailian");
        }
    }

    private Map<String, Object> postJson(String url, Map<String, Object> payload, String authorization, int timeoutSeconds) throws Exception {
        return postJson(url, payload, authorization, timeoutSeconds, Map.of());
    }

    private Map<String, Object> postJson(
        String url,
        Map<String, Object> payload,
        String authorization,
        int timeoutSeconds,
        Map<String, String> extraHeaders
    ) throws Exception {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)))
            .header("Authorization", authorization)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)));
        extraHeaders.forEach(requestBuilder::header);
        HttpResponse<String> response = http.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(response.body());
        }
        return parseJsonObject(response.body());
    }

    private Map<String, Object> getJson(String url, String authorization, int timeoutSeconds) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)))
            .GET();
        if (authorization != null && !authorization.isBlank()) {
            request.header("Authorization", authorization);
        }
        HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(response.body());
        }
        return parseJsonObject(response.body());
    }

    private byte[] downloadBytes(String url, int timeoutSeconds) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)))
            .GET()
            .build();
        HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(new String(response.body(), StandardCharsets.UTF_8));
        }
        return response.body();
    }

    private Map<String, Object> parseJsonObject(String body) {
        if (body == null || body.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return mapper.readValue(body, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ignored) {
            return db.map("raw", body);
        }
    }

    private String extractChatReply(Map<String, Object> payload) {
        Object choices = payload.get("choices");
        if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object message = first.get("message");
            if (message instanceof Map<?, ?> msg && msg.get("content") != null) {
                return msg.get("content").toString();
            }
        }
        return "";
    }

    private String nestedString(Map<String, Object> payload, String... keys) {
        Object current = payload;
        for (String key : keys) {
            if (!(current instanceof Map<?, ?> map)) {
                return "";
            }
            current = map.get(key);
        }
        return current == null ? "" : current.toString().trim();
    }

    private String mapString(Map<?, ?> payload, String key) {
        Object value = payload.get(key);
        return value == null ? "" : value.toString().trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String compactJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return String.valueOf(value);
        }
    }

    private void assertBailianApiKey() {
        if (properties.bailianApiKey == null || properties.bailianApiKey.isBlank()) {
            throw new IllegalStateException("kinecho.bailian-api-key is not configured");
        }
    }

    private String bailianVoiceFileUrl(Path file, String origin) {
        String filename = file.getFileName().toString();
        if (properties.bailianAsrFileBaseUrl != null && !properties.bailianAsrFileBaseUrl.isBlank()) {
            return properties.bailianAsrFileBaseUrl.replaceAll("/$", "") + "/uploads/ai-voice/" + filename;
        }
        return absoluteAssetUrl(origin, "uploads/ai-voice/" + filename);
    }

    private void recordInteraction(String type, String content, String username, String way) {
        String text = content == null ? "" : content.trim();
        if (text.isBlank()) {
            return;
        }
        AiInteraction row = new AiInteraction();
        row.setUsername(normalizeUser(username));
        row.setType(type);
        row.setWay(way == null ? "text" : way);
        row.setContent(text);
        row.setCreatetime(Instant.now().toEpochMilli());
        row.setTimetext(db.nowString());
        aiInteractionMapper.insert(row);
    }

    private String sanitizeReply(String reply) {
        if (reply == null) {
            return "";
        }
        String cleaned = reply.replaceAll("(?is)<think>.*?</think>", "").trim();
        return cleaned.isBlank() ? localReply("") : cleaned;
    }

    private String localReply(String message) {
        String content = message == null ? "" : message.trim();
        if (content.isBlank()) {
            return "我在这里陪着您，您慢慢说。";
        }
        if (content.contains("喝水")) {
            return "好呀，先喝几口温水，慢一点就好。";
        }
        if (content.contains("吃药") || content.contains("药")) {
            return "吃药这件事很重要，我陪您一起记着。";
        }
        if (content.contains("家人") || content.contains("儿子") || content.contains("女儿")) {
            return "听起来您很惦记家人，我会帮您把这份心意好好留着。";
        }
        return "我听到了。我们慢慢说，我会一直陪着您。";
    }

    private void pruneAudioFiles() {
        try (var stream = Files.list(properties.aiAudioDir)) {
            List<Path> files = stream
                .filter(Files::isRegularFile)
                .sorted((a, b) -> {
                    try {
                        return Files.getLastModifiedTime(b).compareTo(Files.getLastModifiedTime(a));
                    } catch (IOException ignored) {
                        return 0;
                    }
                })
                .toList();
            for (int i = Math.max(1, properties.aiAudioRetentionCount); i < files.size(); i++) {
                Files.deleteIfExists(files.get(i));
            }
        } catch (IOException ignored) {
        }
    }

    private String normalizeUser(String user) {
        return user == null || user.isBlank() ? "User" : user.trim();
    }

    private String extension(String filename, String fallback) {
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return fallback;
        }
        return filename.substring(dot + 1).toLowerCase();
    }

    private String absoluteAssetUrl(String origin, String relativePath) {
        String base = origin == null || origin.isBlank() ? "http://127.0.0.1:8000" : origin;
        return base.replaceAll("/$", "") + "/" + relativePath.replace("\\", "/").replaceAll("^/+", "");
    }

    private String bearer(String key) {
        return "Bearer " + key;
    }

    private record TranscriptionResult(String text, String error, String provider) {}
    private record SpeechResult(String url, String error, String provider) {}
}
