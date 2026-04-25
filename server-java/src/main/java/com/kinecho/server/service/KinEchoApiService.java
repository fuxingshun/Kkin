package com.kinecho.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.mapper.KinEchoMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class KinEchoApiService {
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final KinEchoMapper db;
    private final KinEchoProperties properties;
    private final AiCompanionService aiCompanion;
    private final ToastService toastService;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    public KinEchoApiService(KinEchoMapper db, KinEchoProperties properties, AiCompanionService aiCompanion, ToastService toastService, ObjectMapper mapper) {
        this.db = db;
        this.properties = properties;
        this.aiCompanion = aiCompanion;
        this.toastService = toastService;
        this.mapper = mapper;
    }
    public ResponseEntity<Map<String, Object>> login(Map<String, Object> data) {
        if (!has(data, "role", "username", "password")) {
            return bad("missing required fields");
        }

        String role = db.string(data.get("role")).trim().toLowerCase();
        String username = db.string(data.get("username")).trim();
        String password = db.string(data.get("password")).trim();
        if (blank(username) || blank(password)) {
            return bad("username and password are required");
        }

        return switch (role) {
            case "elderly" -> loginUser("elderly", username, password);
            case "family" -> loginUser("family", username, password);
            case "service" -> loginOperator("service", username, password, properties.serviceUsername, properties.servicePassword, properties.serviceDisplayName);
            case "admin" -> loginOperator("admin", username, password, properties.adminUsername, properties.adminPassword, properties.adminDisplayName);
            default -> bad("invalid role");
        };
    }
    public ResponseEntity<Map<String, Object>> getFamilySchedules(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> schedules = db.list("""
            SELECT s.*, u.name AS creator_name
            FROM schedules s
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.family_id = ? AND s.is_active = 1
            ORDER BY s.schedule_time DESC
            """, family_id);
        return ok("schedules", schedules);
    }
    public ResponseEntity<Map<String, Object>> createSchedule(Map<String, Object> data) {
        if (!has(data, "family_id", "title", "schedule_time")) {
            return bad("missing required fields");
        }
        long id = db.insert("""
            INSERT INTO schedules (family_id, title, description, schedule_type, schedule_time, repeat_type, repeat_days, auto_remind, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            data.get("family_id"), data.get("title"), value(data, "description", ""),
            value(data, "schedule_type", "other"), data.get("schedule_time"), value(data, "repeat_type", "once"),
            value(data, "repeat_days", ""), value(data, "auto_remind", 1), data.get("created_by"));
        return created(db.map("success", true, "schedule_id", id));
    }
    public ResponseEntity<Map<String, Object>> updateSchedule(long scheduleId, Map<String, Object> data) {
        List<String> allowed = List.of("title", "description", "schedule_type", "schedule_time", "repeat_type", "repeat_days", "auto_remind", "status");
        return familyScopedUpdate("schedules", scheduleId, db.string(data.get("family_id")), data, allowed, "schedule");
    }
    public ResponseEntity<Map<String, Object>> deleteSchedule(long scheduleId, String familyId) {
        return softDeleteFamilyRecord("schedules", scheduleId, familyId, "schedule");
    }
    public ResponseEntity<Map<String, Object>> getFamilyAlerts(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("a.family_id = ? AND a.is_active = 1 AND a.alert_type != 'media_display'", familyId);
        String status = params.get("status");
        if ("unhandled".equals(status)) {
            query.add("a.handled = 0");
        } else if ("handled".equals(status)) {
            query.add("a.handled = 1");
        }
        addBooleanFilter(query, "a.handled", params.get("handled"));
        addBooleanFilter(query, "a." + db.readColumn(), params.get("read"));
        addEquals(query, "a.alert_type", params.get("alert_type"));
        addEquals(query, "a.elderly_id", params.get("elderly_id"));
        addEquals(query, "a.level", params.get("level"));
        int limit = intParam(params, "limit", 100);
        int offset = intParam(params, "offset", 0);
        long total = db.count("SELECT COUNT(*) FROM family_alerts a WHERE " + query.where, query.args());
        List<Object> args = query.argsList();
        args.add(limit);
        args.add(offset);
        List<Map<String, Object>> alerts = db.list("""
            SELECT a.*, u.name AS elderly_name, h.name AS handler_name
            FROM family_alerts a
            LEFT JOIN users u ON a.elderly_id = u.id
            LEFT JOIN users h ON a.handled_by = h.id
            WHERE %s
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
            """.formatted(query.where), args.toArray());
        for (Map<String, Object> item : alerts) {
            item.put("handled", db.boolValue(item.get("handled")));
            item.put("read", db.boolValue(item.get("read")));
            item.put("metadata", db.jsonMap(item.get("metadata")));
        }
        return ok(db.map("alerts", alerts, "total", total, "limit", limit, "offset", offset));
    }
    public ResponseEntity<Map<String, Object>> createAlert(Map<String, Object> data) {
        if (!has(data, "family_id", "alert_type", "level", "message")) {
            return bad("missing required fields");
        }
        long id = insertAlert(data, db.string(value(data, "source", "elderly")));
        return created(db.map("success", true, "alert_id", id));
    }
    public ResponseEntity<Map<String, Object>> handleAlert(long alertId, Map<String, Object> data) {
        Map<String, Object> body = data == null ? new LinkedHashMap<>() : new LinkedHashMap<>(data);
        ResponseEntity<Map<String, Object>> guard = requireFamilyRecord("family_alerts", alertId, db.string(body.get("family_id")), "alert");
        if (guard != null) {
            return guard;
        }
        int updated = db.update("""
            UPDATE family_alerts
            SET handled = 1, handled_at = CURRENT_TIMESTAMP, handled_by = ?, reply_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND family_id = ? AND is_active = 1
            """, body.get("handled_by"), body.get("reply_message"), alertId, body.get("family_id"));
        if (updated == 0) {
            return notFound("alert not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> markAlertRead(long alertId, String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int updated = db.update(
            "UPDATE family_alerts SET " + db.readColumn() + " = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ? AND is_active = 1",
            alertId,
            familyId
        );
        if (updated == 0) {
            return notFound("alert not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> replyAlert(long alertId, Map<String, Object> data) {
        Map<String, Object> body = data == null ? new LinkedHashMap<>() : new LinkedHashMap<>(data);
        if (!body.containsKey("reply_message")) {
            return bad("missing reply_message");
        }
        ResponseEntity<Map<String, Object>> guard = requireFamilyRecord("family_alerts", alertId, db.string(body.get("family_id")), "alert");
        if (guard != null) {
            return guard;
        }
        int updated = db.update(
            "UPDATE family_alerts SET reply_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ? AND is_active = 1",
            body.get("reply_message"),
            alertId,
            body.get("family_id")
        );
        if (updated == 0) {
            return notFound("alert not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> deleteAlert(long alertId, String familyId) {
        return softDeleteFamilyRecord("family_alerts", alertId, familyId, "alert");
    }
    public ResponseEntity<Map<String, Object>> getAlertStats(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        Map<String, Object> levelStats = rowsToCountMap(db.list("""
            SELECT level, COUNT(*) AS count FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            GROUP BY level
            """, family_id), "level");
        Map<String, Object> typeStats = rowsToCountMap(db.list("""
            SELECT alert_type, COUNT(*) AS count FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            GROUP BY alert_type
            """, family_id), "alert_type");
        Map<String, Object> statusStats = db.one("""
            SELECT
                COUNT(CASE WHEN handled = 0 THEN 1 END) AS unhandled,
                COUNT(CASE WHEN handled = 1 THEN 1 END) AS handled,
                COUNT(CASE WHEN %s = 0 THEN 1 END) AS unread
            FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            """.formatted(db.readColumn()), family_id).orElseGet(LinkedHashMap::new);
        long today = db.count("""
            SELECT COUNT(*) FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display' AND DATE(created_at) = ?
            """, family_id, LocalDate.now(properties.zoneId).toString());
        return ok(db.map("level_stats", levelStats, "type_stats", typeStats, "status_stats", statusStats, "today_count", today));
    }
    public ResponseEntity<Map<String, Object>> getFamilyMessages(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> messages = db.list("""
            SELECT * FROM family_messages
            WHERE family_id = ? AND is_active = 1
            ORDER BY created_at DESC
            """, family_id);
        normalizeMessageBooleans(messages);
        return ok("messages", messages);
    }
    public ResponseEntity<Map<String, Object>> createMessage(Map<String, Object> data) {
        if (!has(data, "family_id", "content", "sender_name", "sender_relation", "scheduled_time")) {
            return bad("missing required fields");
        }
        long id = db.insert("""
            INSERT INTO family_messages (family_id, content, sender_name, sender_relation, scheduled_time)
            VALUES (?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("content"), data.get("sender_name"), data.get("sender_relation"), data.get("scheduled_time"));
        return created(db.map("success", true, "message_id", id));
    }
    public ResponseEntity<Map<String, Object>> deleteMessage(long messageId, String familyId) {
        return softDeleteFamilyRecord("family_messages", messageId, familyId, "message");
    }
    public ResponseEntity<Map<String, Object>> getElderlyMessages(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> messages = db.list("""
            SELECT * FROM family_messages
            WHERE family_id = ? AND is_active = 1
            ORDER BY scheduled_time ASC
            """, family_id);
        normalizeMessageBooleans(messages);
        return ok("messages", messages);
    }
    public ResponseEntity<Map<String, Object>> getPendingMessages(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        LocalDateTime now = LocalDateTime.now(properties.zoneId);
        LocalDate today = now.toLocalDate();
        List<Map<String, Object>> all = db.list("""
            SELECT * FROM family_messages
            WHERE family_id = ? AND is_active = 1 AND played = 0
            ORDER BY scheduled_time ASC
            """, family_id);
        List<Map<String, Object>> pending = new ArrayList<>();
        for (Map<String, Object> msg : all) {
            LocalDateTime scheduled = db.parseDateTime(msg.get("scheduled_time"));
            if (scheduled != null && scheduled.toLocalDate().equals(today) && !scheduled.isAfter(now)) {
                msg.put("played", db.boolValue(msg.get("played")));
                msg.put("liked", db.boolValue(msg.get("liked")));
                pending.add(msg);
            }
        }
        return ok("messages", pending);
    }
    public ResponseEntity<Map<String, Object>> playMessage(long messageId) {
        db.update("UPDATE family_messages SET played = 1, played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", messageId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> likeMessage(long messageId) {
        db.update("UPDATE family_messages SET liked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", messageId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> unlikeMessage(long messageId) {
        db.update("UPDATE family_messages SET liked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", messageId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> createElderlyAlert(Map<String, Object> data) {
        if (!has(data, "family_id", "alert_type", "level", "message")) {
            return bad("missing required fields");
        }
        long id = insertAlert(data, "elderly");
        return created(db.map("success", true, "alert_id", id));
    }
    public ResponseEntity<Map<String, Object>> getElderlyAlertReplies(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("family_id = ? AND is_active = 1 AND reply_message IS NOT NULL", familyId);
        addEquals(query, "elderly_id", params.get("elderly_id"));
        List<Map<String, Object>> replies = db.list("""
            SELECT id, alert_type, level, message, reply_message, handled_at, created_at
            FROM family_alerts
            WHERE %s
            ORDER BY handled_at DESC
            LIMIT 10
            """.formatted(query.where), query.args());
        return ok("replies", replies);
    }
    public ResponseEntity<Map<String, Object>> createMood(Map<String, Object> data) {
        if (!has(data, "family_id", "mood_type")) {
            return bad("missing required fields");
        }
        String moodType = db.string(data.get("mood_type"));
        if (!List.of("happy", "calm", "sad", "anxious", "angry", "tired").contains(moodType)) {
            return bad("invalid mood_type");
        }
        int score = db.intValue(value(data, "mood_score", 5), 5);
        if (score < 1 || score > 10) {
            return bad("mood_score must be 1-10");
        }
        Object elderlyId = value(data, "elderly_id", null);
        String familyId = db.string(data.get("family_id"));
        String recordedAt = db.string(value(data, "recorded_at", db.nowString()));
        LocalDate recordDate = db.parseDateTime(recordedAt) == null
            ? LocalDate.now(properties.zoneId)
            : db.parseDateTime(recordedAt).toLocalDate();
        long existingTodayCount = db.count("""
            SELECT COUNT(*)
            FROM mood_records
            WHERE family_id = ? AND elderly_id = ? AND source = 'manual' AND DATE(recorded_at) = ?
            """, familyId, elderlyId, recordDate.toString());
        if (existingTodayCount > 0) {
            return bad("today mood already recorded");
        }
        long id = db.insert("""
            INSERT INTO mood_records (family_id, elderly_id, mood_type, mood_score, note, source, trigger_event, location, weather, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, familyId, elderlyId, moodType, score, value(data, "note", ""),
            value(data, "source", "manual"), value(data, "trigger_event", ""), value(data, "location", ""),
            value(data, "weather", ""), recordedAt);
        return created(db.map("success", true, "record_id", id));
    }
    public ResponseEntity<Map<String, Object>> getElderlyMoods(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("family_id = ?", familyId);
        addEquals(query, "elderly_id", params.get("elderly_id"));
        int limit = intParam(params, "limit", 50);
        int offset = intParam(params, "offset", 0);
        long total = db.count("SELECT COUNT(*) FROM mood_records WHERE " + query.where, query.args());
        List<Object> args = query.argsList();
        args.add(limit);
        args.add(offset);
        List<Map<String, Object>> rows = db.list("SELECT * FROM mood_records WHERE " + query.where + " ORDER BY recorded_at DESC LIMIT ? OFFSET ?", args.toArray());
        return ok(db.map("records", rows, "total", total, "limit", limit, "offset", offset));
    }
    public ResponseEntity<Map<String, Object>> getTodayMoods(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("family_id = ? AND DATE(recorded_at) = ?", familyId, LocalDate.now(properties.zoneId).toString());
        addEquals(query, "elderly_id", params.get("elderly_id"));
        return ok("records", db.list("SELECT * FROM mood_records WHERE " + query.where + " ORDER BY recorded_at DESC", query.args()));
    }
    public ResponseEntity<Map<String, Object>> getLatestMood(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("family_id = ?", familyId);
        addEquals(query, "elderly_id", params.get("elderly_id"));
        Map<String, Object> record = db.one("SELECT * FROM mood_records WHERE " + query.where + " ORDER BY recorded_at DESC LIMIT 1", query.args()).orElse(null);
        return ok("record", record);
    }
    public ResponseEntity<Map<String, Object>> getWeather(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String latitude = params.get("latitude");
        String longitude = params.get("longitude");
        if (!blank(latitude) && !blank(longitude)) {
            try {
                String url = "https://api.open-meteo.com/v1/forecast?latitude=" + enc(latitude)
                    + "&longitude=" + enc(longitude) + "&current=temperature_2m,weather_code&timezone=auto";
                HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(java.time.Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
                Map<?, ?> body = mapper.readValue(response.body(), Map.class);
                Map<?, ?> current = body.get("current") instanceof Map<?, ?> c ? c : Map.of();
                return ok("weather", weatherPayload(current.get("weather_code"), current.get("temperature_2m"), "geolocation"));
            } catch (Exception ignored) {
            }
        }
        QueryParts query = new QueryParts("family_id = ? AND weather IS NOT NULL AND weather != ''", familyId);
        addEquals(query, "elderly_id", params.get("elderly_id"));
        Map<String, Object> row = db.one("SELECT weather FROM mood_records WHERE " + query.where + " ORDER BY recorded_at DESC LIMIT 1", query.args()).orElse(null);
        if (row != null) {
            return ok("weather", db.map("icon", "☁", "text", row.get("weather"), "source", "mood", "weather_code", null, "temperature", null));
        }
        return ok("weather", weatherPayload(null, null, "fallback"));
    }
    public ResponseEntity<Map<String, Object>> getFamilyMoods(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("m.family_id = ?", familyId);
        addEquals(query, "m.elderly_id", params.get("elderly_id"));
        addEquals(query, "m.mood_type", params.get("mood_type"));
        if (!blank(params.get("start_date"))) {
            query.add("DATE(m.recorded_at) >= ?", params.get("start_date"));
        }
        if (!blank(params.get("end_date"))) {
            query.add("DATE(m.recorded_at) <= ?", params.get("end_date"));
        }
        int limit = intParam(params, "limit", 100);
        int offset = intParam(params, "offset", 0);
        long total = db.count("SELECT COUNT(*) FROM mood_records m WHERE " + query.where, query.args());
        List<Object> args = query.argsList();
        args.add(limit);
        args.add(offset);
        List<Map<String, Object>> rows = db.list("""
            SELECT m.*, u.name AS elderly_name
            FROM mood_records m
            LEFT JOIN users u ON m.elderly_id = u.id
            WHERE %s
            ORDER BY m.recorded_at DESC
            LIMIT ? OFFSET ?
            """.formatted(query.where), args.toArray());
        return ok(db.map("records", rows, "total", total, "limit", limit, "offset", offset));
    }
    public ResponseEntity<Map<String, Object>> getMoodStats(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int days = intParam(params, "days", 7);
        String start = LocalDate.now(properties.zoneId).minusDays(days).toString();
        QueryParts query = new QueryParts("family_id = ? AND DATE(recorded_at) >= ?", familyId, start);
        addEquals(query, "elderly_id", params.get("elderly_id"));
        List<Map<String, Object>> moodStats = db.list("""
            SELECT mood_type, COUNT(*) AS count, AVG(mood_score) AS avg_score
            FROM mood_records WHERE %s GROUP BY mood_type ORDER BY count DESC
            """.formatted(query.where), query.args());
        roundAvg(moodStats);
        List<Map<String, Object>> dailyStats = db.list("""
            SELECT DATE(recorded_at) AS date, AVG(mood_score) AS avg_score, COUNT(*) AS count
            FROM mood_records WHERE %s GROUP BY DATE(recorded_at) ORDER BY date DESC
            """.formatted(query.where), query.args());
        roundAvg(dailyStats);
        Map<String, Object> overall = db.one("""
            SELECT COUNT(*) AS total_records, AVG(mood_score) AS avg_score, MAX(mood_score) AS max_score, MIN(mood_score) AS min_score
            FROM mood_records WHERE %s
            """.formatted(query.where), query.args()).orElseGet(LinkedHashMap::new);
        roundAvg(List.of(overall));
        QueryParts todayQuery = new QueryParts("family_id = ? AND DATE(recorded_at) = ?", familyId, LocalDate.now(properties.zoneId).toString());
        addEquals(todayQuery, "elderly_id", params.get("elderly_id"));
        long today = db.count("SELECT COUNT(*) FROM mood_records WHERE " + todayQuery.where, todayQuery.args());
        return ok(db.map("mood_type_stats", moodStats, "daily_stats", dailyStats, "overall", overall, "today_count", today, "days", days));
    }
    public ResponseEntity<Map<String, Object>> getMoodTrend(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int days = intParam(params, "days", 30);
        QueryParts query = new QueryParts("family_id = ? AND DATE(recorded_at) >= ?", familyId, LocalDate.now(properties.zoneId).minusDays(days).toString());
        addEquals(query, "elderly_id", params.get("elderly_id"));
        List<Map<String, Object>> trend = db.list("""
            SELECT DATE(recorded_at) AS date, mood_type, AVG(mood_score) AS avg_score, COUNT(*) AS count
            FROM mood_records WHERE %s
            GROUP BY DATE(recorded_at), mood_type
            ORDER BY date ASC, count DESC
            """.formatted(query.where), query.args());
        roundAvg(trend);
        return ok(db.map("trend", trend, "days", days));
    }
    public ResponseEntity<Map<String, Object>> getFamilyInteractions(String username,
                                                                     int limit) {
        int normalized = Math.max(1, Math.min(limit, 500));
        return ok(db.map("list", aiCompanion.getInteractionHistory(username, normalized), "available", true, "error", "",
            "username", username, "limit", normalized, "source", "ai-companion"));
    }
    public ResponseEntity<Map<String, Object>> clearFamilyInteractions(Map<String, Object> data,
                                                                       String username) {
        String bodyUsername = data == null ? "" : db.string(data.get("username")).trim();
        String scope = !bodyUsername.isBlank() ? bodyUsername : (username == null ? "" : username.trim());
        String finalScope = scope.isBlank() ? null : scope;
        long deleted = aiCompanion.clearInteractions(finalScope);
        return ok(db.map("success", true, "username", finalScope == null ? "all" : finalScope, "deleted", deleted, "source", "ai-companion"));
    }
    public ResponseEntity<Map<String, Object>> getMessagesCompat(Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String username = db.string(value(body, "username", "User"));
        int limit = db.intValue(value(body, "limit", 100), 100);
        return ok(db.map("list", aiCompanion.getInteractionHistory(username, limit)));
    }
    public ResponseEntity<Map<String, Object>> getTodaySchedules(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        LocalDate today = LocalDate.now(properties.zoneId);
        int weekday = today.getDayOfWeek().getValue() % 7;
        List<Map<String, Object>> all = db.list("""
            SELECT * FROM schedules WHERE family_id = ? AND is_active = 1 ORDER BY schedule_time
            """, family_id);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> item : all) {
            LocalDateTime scheduleTime = db.parseDateTime(item.get("schedule_time"));
            String repeat = db.string(value(item, "repeat_type", "once"));
            boolean include = switch (repeat) {
                case "daily" -> true;
                case "weekly" -> db.parseRepeatDays(item.get("repeat_days")).contains(weekday);
                case "monthly" -> scheduleTime != null && scheduleTime.getDayOfMonth() == today.getDayOfMonth();
                default -> scheduleTime != null && scheduleTime.toLocalDate().equals(today);
            };
            if (include) {
                result.add(item);
            }
        }
        result.sort(Comparator.comparing(item -> {
            LocalDateTime dt = db.parseDateTime(item.get("schedule_time"));
            return dt == null ? LocalDateTime.MIN : dt;
        }));
        return ok("schedules", result);
    }
    public ResponseEntity<Map<String, Object>> getScheduleHistory(String family_id,
                                                                  int limit) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        int normalized = Math.max(1, Math.min(limit, 100));
        LocalDateTime now = LocalDateTime.now(properties.zoneId);
        List<Map<String, Object>> all = db.list("""
            SELECT * FROM schedules WHERE family_id = ? AND is_active = 1 ORDER BY schedule_time DESC
            """, family_id);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> item : all) {
            String status = db.string(value(item, "status", "pending")).toLowerCase();
            LocalDateTime scheduleTime = db.parseDateTime(item.get("schedule_time"));
            boolean include = List.of("completed", "skipped", "missed").contains(status) || (scheduleTime != null && scheduleTime.isBefore(now));
            if (include) {
                result.add(item);
                if (result.size() >= normalized) {
                    break;
                }
            }
        }
        return ok(db.map("schedules", result, "limit", normalized));
    }
    public ResponseEntity<Map<String, Object>> getUpcomingSchedules(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        String now = LocalDateTime.now(properties.zoneId).format(DATE_TIME);
        String soon = LocalDateTime.now(properties.zoneId).plusHours(1).format(DATE_TIME);
        List<Map<String, Object>> schedules = db.list("""
            SELECT * FROM schedules
            WHERE family_id = ? AND is_active = 1 AND schedule_time BETWEEN ? AND ?
            ORDER BY schedule_time
            """, family_id, now, soon);
        return ok("schedules", schedules);
    }
    public ResponseEntity<Map<String, Object>> completeReminder(long reminderId, String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int updated = db.update("""
            UPDATE reminders
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND schedule_id IN (
                  SELECT id FROM schedules WHERE family_id = ? AND is_active = 1
              )
            """, reminderId, familyId);
        if (updated == 0) {
            return notFound("reminder not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> dismissReminder(long reminderId, String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int updated = db.update("""
            UPDATE reminders
            SET status = 'dismissed'
            WHERE id = ?
              AND schedule_id IN (
                  SELECT id FROM schedules WHERE family_id = ? AND is_active = 1
              )
            """, reminderId, familyId);
        if (updated == 0) {
            return notFound("reminder not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> updateScheduleStatus(long scheduleId, Map<String, Object> data) {
        String familyId = db.string(data.get("family_id"));
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String status = db.string(data.get("status"));
        if (!List.of("pending", "completed", "skipped", "missed").contains(status)) {
            return bad("invalid status");
        }
        int updated;
        if ("completed".equals(status)) {
            updated = db.update(
                "UPDATE schedules SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ? AND is_active = 1",
                status,
                scheduleId,
                familyId
            );
        } else {
            updated = db.update(
                "UPDATE schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ? AND is_active = 1",
                status,
                scheduleId,
                familyId
            );
        }
        if (updated == 0) {
            return notFound("schedule not found");
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> createUser(Map<String, Object> data) {
        if (!has(data, "user_type", "name", "family_id")) {
            return bad("missing required fields");
        }
        String userType = db.string(data.get("user_type"));
        if (!List.of("elderly", "family").contains(userType)) {
            return bad("invalid user_type");
        }
        String bindingCode = "elderly".equals(userType) ? nextBindingCode() : "";
        long id = db.insert("INSERT INTO users (user_type, name, phone, family_id, binding_code, is_active, created_by, updated_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
            userType, data.get("name"), value(data, "phone", ""), data.get("family_id"), bindingCode,
            value(data, "created_by", value(data, "operator", "")), value(data, "updated_by", value(data, "operator", "")));
        return created(db.map("success", true, "user_id", id));
    }

    public ResponseEntity<Map<String, Object>> updateUser(long userId, Map<String, Object> data) {
        if (data == null || blank(db.string(data.get("family_id")))) {
            return bad("missing family_id");
        }
        String familyId = db.string(data.get("family_id"));
        if (db.one("SELECT id FROM users WHERE id = ? AND family_id = ? AND is_active = 1", userId, familyId).isEmpty()) {
            return notFound("user not found");
        }

        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (data.containsKey("name")) {
            String name = db.string(data.get("name")).trim();
            if (name.isBlank()) {
                return bad("name cannot be blank");
            }
            sets.add("name = ?");
            args.add(name);
        }
        if (data.containsKey("phone")) {
            sets.add("phone = ?");
            args.add(db.string(data.get("phone")).trim());
        }
        if (data.containsKey("updated_by") || data.containsKey("operator")) {
            sets.add("updated_by = ?");
            args.add(db.string(value(data, "updated_by", value(data, "operator", ""))).trim());
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }

        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(userId);
        args.add(familyId);
        db.update("UPDATE users SET " + String.join(", ", sets) + " WHERE id = ? AND family_id = ? AND is_active = 1", args.toArray());
        return ok(db.ok());
    }

    public ResponseEntity<Map<String, Object>> deleteUser(long userId, String familyId, String operator) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> user = db.one("SELECT id, user_type FROM users WHERE id = ? AND family_id = ? AND is_active = 1", userId, familyId).orElse(null);
        if (user == null) {
            return notFound("user not found");
        }
        if (!"family".equals(db.string(user.get("user_type")))) {
            return bad("only family contacts can be deleted");
        }

        db.update("""
            UPDATE users
            SET is_active = 0, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND family_id = ? AND user_type = 'family' AND is_active = 1
            """, blank(operator) ? "" : operator.trim(), userId, familyId);
        return ok(db.ok());
    }

    public ResponseEntity<Map<String, Object>> getFamilyUsers(String familyId) {
        return ok("users", db.list("SELECT * FROM users WHERE family_id = ? AND is_active = 1 ORDER BY user_type, created_at", familyId));
    }

    public ResponseEntity<Map<String, Object>> getUserBindingCode(long userId, String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> user = db.one("""
            SELECT id, family_id, user_type, name, binding_code
            FROM users
            WHERE id = ? AND family_id = ? AND is_active = 1
            """, userId, familyId).orElse(null);
        if (user == null) {
            return notFound("user not found");
        }
        if (!"elderly".equals(db.string(user.get("user_type")))) {
            return bad("binding code is only available for elderly users");
        }

        String bindingCode = db.string(user.get("binding_code")).trim();
        if (bindingCode.isBlank()) {
            bindingCode = nextBindingCode();
            db.update("UPDATE users SET binding_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", bindingCode, userId);
        }
        return ok(db.map(
            "binding_code", bindingCode,
            "family_id", familyId,
            "elderly_id", userId,
            "elderly_name", user.get("name")
        ));
    }

    public ResponseEntity<Map<String, Object>> bindFamilyByCode(Map<String, Object> data) {
        if (!has(data, "binding_code", "name")) {
            return bad("missing required fields");
        }
        String bindingCode = db.string(data.get("binding_code")).trim().toUpperCase();
        Map<String, Object> elderly = db.one("""
            SELECT id, family_id, name, binding_code
            FROM users
            WHERE binding_code = ? AND user_type = 'elderly' AND is_active = 1
            """, bindingCode).orElse(null);
        if (elderly == null) {
            return notFound("binding code not found");
        }

        String familyId = db.string(elderly.get("family_id"));
        String phone = db.string(value(data, "phone", "")).trim();
        String operator = db.string(value(data, "operator", "family-bind")).trim();
        String name = db.string(data.get("name")).trim();

        Map<String, Object> existingFamilyUser = phone.isBlank()
            ? null
            : db.one("""
                SELECT id FROM users
                WHERE family_id = ? AND phone = ? AND user_type = 'family' AND is_active = 1
                LIMIT 1
                """, familyId, phone).orElse(null);

        long userId;
        if (existingFamilyUser != null) {
            userId = db.longValue(existingFamilyUser.get("id"), 0);
            db.update("""
                UPDATE users
                SET name = ?, phone = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND is_active = 1
                """, name, phone, operator, userId);
        } else {
            userId = db.insert("""
                INSERT INTO users (user_type, name, phone, family_id, binding_code, is_active, created_by, updated_by)
                VALUES ('family', ?, ?, ?, '', 1, ?, ?)
                """, name, phone, familyId, operator, operator);
        }

        return ok(db.map(
            "success", true,
            "user_id", userId,
            "family_id", familyId,
            "elderly_id", elderly.get("id"),
            "elderly_name", elderly.get("name"),
            "binding_code", bindingCode
        ));
    }
    public ResponseEntity<Map<String, Object>> getServiceOverview(String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        Map<String, Object> taskStats = db.one("""
            SELECT
                COUNT(CASE WHEN handled = 0 AND %s = 0 THEN 1 END) AS pending,
                COUNT(CASE WHEN handled = 0 AND %s = 1 THEN 1 END) AS processing,
                COUNT(CASE WHEN handled = 1 THEN 1 END) AS completed,
                COUNT(*) AS total
            FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            """.formatted(db.readColumn(), db.readColumn()), familyId).orElseGet(LinkedHashMap::new);

        Map<String, Object> followupStats = db.one("""
            SELECT
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) AS scheduled,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
                COUNT(CASE WHEN status IN ('scheduled', 'in_progress') THEN 1 END) AS active,
                COUNT(*) AS total
            FROM consultations
            WHERE family_id = ?
            """, familyId).orElseGet(LinkedHashMap::new);

        List<Map<String, Object>> elderlyUsers = db.list("""
            SELECT id
            FROM users
            WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
            ORDER BY created_at
            """, familyId);

        List<Map<String, Object>> alerts = db.list("""
            SELECT elderly_id, level, handled
            FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            """, familyId);

        Map<Long, Integer> moodScoreByElderly = loadLatestMoodScoreByElderly(familyId);

        int high = 0;
        int medium = 0;
        int low = 0;
        for (Map<String, Object> elderly : elderlyUsers) {
            long elderlyId = db.longValue(elderly.get("id"), 0);
            long openAlertCount = alerts.stream()
                .filter(item -> db.longValue(item.get("elderly_id"), 0) == elderlyId)
                .filter(item -> !db.boolValue(item.get("handled")))
                .count();
            boolean hasHighAlert = alerts.stream()
                .filter(item -> db.longValue(item.get("elderly_id"), 0) == elderlyId)
                .anyMatch(item -> !db.boolValue(item.get("handled")) && "high".equals(db.string(item.get("level"))));
            boolean hasMediumAlert = alerts.stream()
                .filter(item -> db.longValue(item.get("elderly_id"), 0) == elderlyId)
                .anyMatch(item -> !db.boolValue(item.get("handled")) && "medium".equals(db.string(item.get("level"))));

            String risk = computeCaseRiskLevel(moodScoreByElderly.get(elderlyId), openAlertCount, hasHighAlert, hasMediumAlert);
            if ("high".equals(risk)) {
                high++;
            } else if ("medium".equals(risk)) {
                medium++;
            } else {
                low++;
            }
        }

        return ok(db.map(
            "family_id", familyId,
            "task_stats", taskStats,
            "case_stats", db.map("high", high, "medium", medium, "low", low, "total", elderlyUsers.size()),
            "followup_stats", followupStats
        ));
    }

    public ResponseEntity<Map<String, Object>> getServiceTasks(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        QueryParts query = new QueryParts("a.family_id = ? AND a.is_active = 1 AND a.alert_type != 'media_display'", familyId);
        addEquals(query, "a.elderly_id", params.get("elderly_id"));
        addEquals(query, "a.level", params.get("level"));
        String status = db.string(params.get("status")).trim().toLowerCase();
        if ("pending".equals(status)) {
            query.add("a.handled = 0");
            query.add("a." + db.readColumn() + " = 0");
        } else if ("processing".equals(status)) {
            query.add("a.handled = 0");
            query.add("a." + db.readColumn() + " = 1");
        } else if ("completed".equals(status)) {
            query.add("a.handled = 1");
        }

        int limit = intParam(params, "limit", 50);
        List<Object> args = query.argsList();
        args.add(limit);
        List<Map<String, Object>> rows = db.list("""
            SELECT a.id, a.id AS alert_id, a.elderly_id, u.name AS elderly_name,
                   a.alert_type, a.title, a.message, a.level, a.handled,
                   a.%s AS task_read, a.created_at
            FROM family_alerts a
            LEFT JOIN users u ON a.elderly_id = u.id
            WHERE %s
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT ?
            """.formatted(db.readColumn(), query.where), args.toArray());

        List<Map<String, Object>> tasks = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String taskStatus = db.boolValue(row.get("handled"))
                ? "completed"
                : db.boolValue(row.get("task_read")) ? "processing" : "pending";
            tasks.add(db.map(
                "id", db.longValue(row.get("id"), 0),
                "alert_id", db.longValue(row.get("alert_id"), 0),
                "elderly_id", db.longValue(row.get("elderly_id"), 0),
                "elderly_name", blank(db.string(row.get("elderly_name"))) ? "未绑定老人" : db.string(row.get("elderly_name")),
                "type_label", blank(db.string(row.get("title"))) ? serviceAlertTypeLabel(db.string(row.get("alert_type"))) : db.string(row.get("title")),
                "reason", db.string(row.get("message")),
                "priority", normalizePriority(db.string(row.get("level"))),
                "status", taskStatus,
                "created_at", db.string(row.get("created_at"))
            ));
        }
        return ok(db.map("tasks", tasks, "limit", limit, "total", tasks.size()));
    }

    public ResponseEntity<Map<String, Object>> startServiceTask(long alertId) {
        db.update("""
            UPDATE family_alerts
            SET %s = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """.formatted(db.readColumn()), alertId);
        return ok(db.map("success", true, "alert_id", alertId, "status", "processing"));
    }

    public ResponseEntity<Map<String, Object>> completeServiceTask(long alertId,
                                                                   Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String replyMessage = db.string(value(body, "reply_message", "服务端已完成处理"));
        db.update("""
            UPDATE family_alerts
            SET handled = 1,
                %s = 1,
                handled_at = CURRENT_TIMESTAMP,
                read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                reply_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """.formatted(db.readColumn()), replyMessage, alertId);
        return ok(db.map("success", true, "alert_id", alertId, "status", "completed"));
    }

    public ResponseEntity<Map<String, Object>> getServiceCases(String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        return ok(db.map("family_id", familyId, "cases", buildServiceCases(familyId)));
    }

    public ResponseEntity<Map<String, Object>> getServiceCaseDetail(String familyId,
                                                                    long elderlyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        if (elderlyId <= 0) {
            return bad("invalid elderly_id");
        }

        List<Map<String, Object>> cases = buildServiceCases(familyId);
        Map<String, Object> caseInfo = cases.stream()
            .filter(item -> db.longValue(item.get("elderly_id"), 0) == elderlyId)
            .findFirst()
            .orElse(null);
        if (caseInfo == null) {
            return notFound("service case not found");
        }

        List<Map<String, Object>> alerts = db.list("""
            SELECT a.*, u.name AS elderly_name
            FROM family_alerts a
            LEFT JOIN users u ON a.elderly_id = u.id
            WHERE a.family_id = ? AND a.elderly_id = ? AND a.is_active = 1 AND a.alert_type != 'media_display'
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 20
            """, familyId, elderlyId);

        List<Map<String, Object>> moodRecords = db.list("""
            SELECT m.*, u.name AS elderly_name
            FROM mood_records m
            LEFT JOIN users u ON m.elderly_id = u.id
            WHERE m.family_id = ? AND m.elderly_id = ?
            ORDER BY m.recorded_at DESC, m.id DESC
            LIMIT 14
            """, familyId, elderlyId);

        List<Map<String, Object>> moodTrend = new ArrayList<>();
        int trendSize = Math.min(7, moodRecords.size());
        for (int index = trendSize - 1; index >= 0; index--) {
            Map<String, Object> record = moodRecords.get(index);
            String recordedAt = db.string(record.get("recorded_at"));
            String day = recordedAt.length() >= 10 ? recordedAt.substring(5, 10) : String.valueOf(trendSize - index);
            moodTrend.add(db.map(
                "day", day,
                "score", db.intValue(record.get("mood_score"), 0)
            ));
        }

        List<Map<String, Object>> consultations = db.list("""
            SELECT c.*, co.name AS counselor_name, co.title AS counselor_title, co.avatar AS counselor_avatar
            FROM consultations c
            LEFT JOIN counselors co ON c.counselor_id = co.id
            WHERE c.family_id = ? AND c.elderly_id = ?
            ORDER BY c.scheduled_time DESC, c.id DESC
            LIMIT 20
            """, familyId, elderlyId);

        List<Map<String, Object>> familyContacts = db.list("""
            SELECT id, name, phone, family_id, user_type
            FROM users
            WHERE family_id = ? AND user_type = 'family' AND is_active = 1
            ORDER BY created_at ASC, id ASC
            """, familyId);

        return ok(db.map(
            "family_id", familyId,
            "case_info", caseInfo,
            "alerts", alerts,
            "mood_records", moodRecords,
            "mood_trend", moodTrend,
            "consultations", consultations,
            "family_contacts", familyContacts
        ));
    }

    public ResponseEntity<Map<String, Object>> getServiceFollowups(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        QueryParts query = new QueryParts("c.family_id = ?", familyId);
        addEquals(query, "c.elderly_id", params.get("elderly_id"));
        addEquals(query, "c.status", params.get("status"));
        int limit = intParam(params, "limit", 30);
        List<Object> args = query.argsList();
        args.add(limit);
        List<Map<String, Object>> followups = db.list("""
            SELECT c.id, c.elderly_id, u.name AS elderly_name,
                   c.consultation_type, c.scheduled_time, c.status, c.note
            FROM consultations c
            LEFT JOIN users u ON c.elderly_id = u.id
            WHERE %s
            ORDER BY c.scheduled_time ASC, c.id ASC
            LIMIT ?
            """.formatted(query.where), args.toArray());
        return ok(db.map("family_id", familyId, "followups", followups, "limit", limit));
    }

    public ResponseEntity<Map<String, Object>> createServiceFollowup(Map<String, Object> data) {
        if (!has(data, "family_id", "elderly_id", "scheduled_time")) {
            return bad("missing required fields");
        }
        long id = db.insert("""
            INSERT INTO consultations (family_id, elderly_id, counselor_id, consultation_type, scheduled_time, duration, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("elderly_id"), data.get("counselor_id"),
            value(data, "consultation_type", "phone"), data.get("scheduled_time"), value(data, "duration", 30),
            value(data, "status", "scheduled"), value(data, "note", ""));
        return created(db.map("success", true, "consultation_id", id));
    }

    public ResponseEntity<Map<String, Object>> updateServiceFollowupStatus(long consultationId,
                                                                           Map<String, Object> data) {
        String familyId = db.string(data.get("family_id"));
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String status = db.string(data.get("status")).trim().toLowerCase();
        if (!List.of("scheduled", "in_progress", "completed", "cancelled").contains(status)) {
            return bad("invalid status");
        }
        int updated = db.update("""
            UPDATE consultations
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND family_id = ?
            """, status, consultationId, familyId);
        if (updated == 0) {
            return notFound("consultation not found");
        }
        return ok(db.map("success", true, "consultation_id", consultationId, "status", status));
    }

    public ResponseEntity<Map<String, Object>> createServiceRecord(Map<String, Object> data) {
        if (!has(data, "family_id", "elderly_id", "content")) {
            return bad("missing required fields");
        }
        String content = db.string(data.get("content")).trim();
        if (content.isBlank()) {
            return bad("content is required");
        }

        String familyId = db.string(data.get("family_id"));
        long alertId = db.longValue(data.get("alert_id"), 0);
        if (alertId > 0) {
            ResponseEntity<Map<String, Object>> guard = requireFamilyRecord("family_alerts", alertId, familyId, "alert");
            if (guard != null) {
                return guard;
            }
        }

        String scheduledTime = db.string(data.get("scheduled_time")).trim();
        String finalScheduledTime = scheduledTime.isBlank() ? LocalDateTime.now(properties.zoneId).format(DATE_TIME) : scheduledTime;
        long consultationId = db.insert("""
            INSERT INTO consultations (family_id, elderly_id, counselor_id, consultation_type, scheduled_time, duration, status, note)
            VALUES (?, ?, ?, 'text', ?, ?, 'completed', ?)
            """, data.get("family_id"), data.get("elderly_id"), data.get("counselor_id"),
            finalScheduledTime, value(data, "duration", 15), content);

        if (alertId > 0) {
            db.update("""
                UPDATE family_alerts
                SET handled = 1,
                    %s = 1,
                    handled_at = CURRENT_TIMESTAMP,
                    read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                    reply_message = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND family_id = ? AND is_active = 1
                """.formatted(db.readColumn()), content, alertId, familyId);
        }

        return created(db.map(
            "success", true,
            "consultation_id", consultationId,
            "alert_id", alertId > 0 ? alertId : null
        ));
    }

    public ResponseEntity<Map<String, Object>> getAdminServiceSummary(String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        List<Map<String, Object>> counselors = db.list("""
            SELECT id, title, available
            FROM counselors
            WHERE is_active = 1
            ORDER BY available DESC, title ASC, id ASC
            """);
        List<Map<String, Object>> consultations = db.list("""
            SELECT elderly_id, counselor_id, status, scheduled_time, updated_at
            FROM consultations
            WHERE family_id = ?
            ORDER BY scheduled_time DESC, id DESC
            """, familyId);
        List<Map<String, Object>> elderlyUsers = db.list("""
            SELECT id, name
            FROM users
            WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
            ORDER BY created_at ASC, id ASC
            """, familyId);
        List<Map<String, Object>> alerts = db.list("""
            SELECT elderly_id, level, handled
            FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            """, familyId);

        Map<Long, Integer> latestMoodScoreByElderly = loadLatestMoodScoreByElderly(familyId);
        Map<Long, Integer> activeCasesByCounselor = new LinkedHashMap<>();
        Map<Long, Integer> activeConsultationsByElderly = new LinkedHashMap<>();
        Map<Long, LocalDateTime> lastFollowupByElderly = new LinkedHashMap<>();
        long activeConsultations = 0;
        long scheduledConsultations = 0;
        for (Map<String, Object> consultation : consultations) {
            String status = db.string(consultation.get("status")).trim().toLowerCase();
            long elderlyId = db.longValue(consultation.get("elderly_id"), 0);
            long counselorId = db.longValue(consultation.get("counselor_id"), 0);
            LocalDateTime followupAt = db.parseDateTime(consultation.get("scheduled_time"));
            if (followupAt == null) {
                followupAt = db.parseDateTime(consultation.get("updated_at"));
            }

            if ("scheduled".equals(status)) {
                scheduledConsultations++;
            }
            if (isActiveConsultationStatus(status)) {
                activeConsultations++;
                if (elderlyId > 0) {
                    activeConsultationsByElderly.put(elderlyId, activeConsultationsByElderly.getOrDefault(elderlyId, 0) + 1);
                }
                if (counselorId > 0) {
                    activeCasesByCounselor.put(counselorId, activeCasesByCounselor.getOrDefault(counselorId, 0) + 1);
                }
            }
            if (elderlyId > 0 && followupAt != null) {
                LocalDateTime current = lastFollowupByElderly.get(elderlyId);
                if (current == null || followupAt.isAfter(current)) {
                    lastFollowupByElderly.put(elderlyId, followupAt);
                }
            }
        }

        Map<Long, Integer> openAlertCountByElderly = new LinkedHashMap<>();
        Map<Long, Boolean> hasHighAlertByElderly = new LinkedHashMap<>();
        Map<Long, Boolean> hasMediumAlertByElderly = new LinkedHashMap<>();
        long pendingAlerts = 0;
        for (Map<String, Object> alert : alerts) {
            if (db.boolValue(alert.get("handled"))) {
                continue;
            }
            long elderlyId = db.longValue(alert.get("elderly_id"), 0);
            if (elderlyId <= 0) {
                continue;
            }
            pendingAlerts++;
            openAlertCountByElderly.put(elderlyId, openAlertCountByElderly.getOrDefault(elderlyId, 0) + 1);
            String level = db.string(alert.get("level")).trim().toLowerCase();
            if ("high".equals(level)) {
                hasHighAlertByElderly.put(elderlyId, true);
            } else if ("medium".equals(level)) {
                hasMediumAlertByElderly.put(elderlyId, true);
            }
        }

        Map<String, int[]> titleStats = new LinkedHashMap<>();
        long availableCounselors = 0;
        for (Map<String, Object> counselor : counselors) {
            String title = db.string(counselor.get("title")).trim();
            if (title.isBlank()) {
                title = "未分类服务角色";
            }
            int[] stats = titleStats.computeIfAbsent(title, ignored -> new int[3]);
            stats[0]++;
            if (db.boolValue(counselor.get("available"))) {
                availableCounselors++;
                stats[1]++;
            }
            long counselorId = db.longValue(counselor.get("id"), 0);
            stats[2] += activeCasesByCounselor.getOrDefault(counselorId, 0);
        }

        List<Map<String, Object>> roleStats = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : titleStats.entrySet()) {
            int[] stats = entry.getValue();
            roleStats.add(db.map(
                "role", entry.getKey(),
                "count", stats[0],
                "available_count", stats[1],
                "active_cases", stats[2]
            ));
        }
        roleStats.sort((left, right) -> {
            int countCompare = Integer.compare(db.intValue(right.get("count"), 0), db.intValue(left.get("count"), 0));
            if (countCompare != 0) {
                return countCompare;
            }
            return db.string(left.get("role")).compareToIgnoreCase(db.string(right.get("role")));
        });

        int highRiskCases = 0;
        List<Map<String, Object>> caseRows = new ArrayList<>();
        for (Map<String, Object> elderly : elderlyUsers) {
            long elderlyId = db.longValue(elderly.get("id"), 0);
            int openAlerts = openAlertCountByElderly.getOrDefault(elderlyId, 0);
            String riskLevel = computeCaseRiskLevel(
                latestMoodScoreByElderly.get(elderlyId),
                openAlerts,
                hasHighAlertByElderly.getOrDefault(elderlyId, false),
                hasMediumAlertByElderly.getOrDefault(elderlyId, false)
            );
            if ("high".equals(riskLevel)) {
                highRiskCases++;
            }

            LocalDateTime lastFollowupAt = lastFollowupByElderly.get(elderlyId);
            caseRows.add(db.map(
                "elderly_id", elderlyId,
                "elderly_name", db.string(elderly.get("name")),
                "risk_level", riskLevel,
                "open_alerts", openAlerts,
                "active_consultations", activeConsultationsByElderly.getOrDefault(elderlyId, 0),
                "latest_mood_score", latestMoodScoreByElderly.getOrDefault(elderlyId, 0),
                "last_followup_at", lastFollowupAt == null ? "" : lastFollowupAt.format(DATE_TIME)
            ));
        }
        caseRows.sort((left, right) -> {
            int riskCompare = Integer.compare(riskPriority(db.string(left.get("risk_level"))), riskPriority(db.string(right.get("risk_level"))));
            if (riskCompare != 0) {
                return riskCompare;
            }
            int alertCompare = Integer.compare(db.intValue(right.get("open_alerts"), 0), db.intValue(left.get("open_alerts"), 0));
            if (alertCompare != 0) {
                return alertCompare;
            }
            int followupCompare = Integer.compare(db.intValue(right.get("active_consultations"), 0), db.intValue(left.get("active_consultations"), 0));
            if (followupCompare != 0) {
                return followupCompare;
            }
            return db.string(left.get("elderly_name")).compareToIgnoreCase(db.string(right.get("elderly_name")));
        });

        return ok(db.map(
            "family_id", familyId,
            "overview", db.map(
                "total_counselors", counselors.size(),
                "available_counselors", availableCounselors,
                "active_consultations", activeConsultations,
                "scheduled_consultations", scheduledConsultations,
                "pending_alerts", pendingAlerts,
                "high_risk_cases", highRiskCases,
                "case_total", caseRows.size()
            ),
            "role_stats", roleStats,
            "case_rows", caseRows
        ));
    }

    public ResponseEntity<Map<String, Object>> getAdminAnalytics(String familyId,
                                                                 int months,
                                                                 int days) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        int normalizedMonths = Math.max(1, Math.min(months, 12));
        int normalizedDays = Math.max(1, Math.min(days, 14));
        YearMonth currentMonth = YearMonth.now(properties.zoneId);
        LocalDate endDate = LocalDate.now(properties.zoneId);
        LocalDate startDate = endDate.minusDays(normalizedDays - 1L);

        List<Map<String, Object>> users = db.list("""
            SELECT user_type, created_at
            FROM users
            WHERE family_id = ? AND is_active = 1
            ORDER BY created_at ASC, id ASC
            """, familyId);

        Map<YearMonth, int[]> userGrowthBuckets = new LinkedHashMap<>();
        for (int offset = normalizedMonths - 1; offset >= 0; offset--) {
            userGrowthBuckets.put(currentMonth.minusMonths(offset), new int[2]);
        }

        int elderlyUsers = 0;
        int familyUsers = 0;
        for (Map<String, Object> user : users) {
            String userType = db.string(user.get("user_type")).trim().toLowerCase();
            if ("elderly".equals(userType)) {
                elderlyUsers++;
            } else if ("family".equals(userType)) {
                familyUsers++;
            }

            LocalDateTime createdAt = db.parseDateTime(user.get("created_at"));
            if (createdAt == null) {
                continue;
            }
            int[] bucket = userGrowthBuckets.get(YearMonth.from(createdAt));
            if (bucket == null) {
                continue;
            }
            if ("elderly".equals(userType)) {
                bucket[0]++;
            } else if ("family".equals(userType)) {
                bucket[1]++;
            }
        }

        List<Map<String, Object>> userGrowth = new ArrayList<>();
        for (Map.Entry<YearMonth, int[]> entry : userGrowthBuckets.entrySet()) {
            int elderly = entry.getValue()[0];
            int family = entry.getValue()[1];
            userGrowth.add(db.map(
                "month", entry.getKey().toString(),
                "elderly", elderly,
                "family", family,
                "total", elderly + family
            ));
        }

        Map<LocalDate, int[]> activityBuckets = new LinkedHashMap<>();
        for (int offset = 0; offset < normalizedDays; offset++) {
            activityBuckets.put(startDate.plusDays(offset), new int[3]);
        }

        List<Map<String, Object>> followupRows = db.list("""
            SELECT scheduled_time
            FROM consultations
            WHERE family_id = ? AND DATE(scheduled_time) >= ?
            ORDER BY scheduled_time ASC, id ASC
            """, familyId, startDate.toString());
        for (Map<String, Object> row : followupRows) {
            LocalDateTime scheduledTime = db.parseDateTime(row.get("scheduled_time"));
            if (scheduledTime == null) {
                continue;
            }
            int[] bucket = activityBuckets.get(scheduledTime.toLocalDate());
            if (bucket != null) {
                bucket[0]++;
            }
        }

        List<Map<String, Object>> mediaPlayRows = db.list("""
            SELECT mph.played_at
            FROM media_play_history mph
            INNER JOIN media m ON m.id = mph.media_id
            WHERE m.family_id = ? AND DATE(mph.played_at) >= ?
            ORDER BY mph.played_at ASC, mph.id ASC
            """, familyId, startDate.toString());
        for (Map<String, Object> row : mediaPlayRows) {
            LocalDateTime playedAt = db.parseDateTime(row.get("played_at"));
            if (playedAt == null) {
                continue;
            }
            int[] bucket = activityBuckets.get(playedAt.toLocalDate());
            if (bucket != null) {
                bucket[1]++;
            }
        }

        List<Map<String, Object>> moodRows = db.list("""
            SELECT recorded_at, mood_score
            FROM mood_records
            WHERE family_id = ? AND DATE(recorded_at) >= ?
            ORDER BY recorded_at ASC, id ASC
            """, familyId, startDate.toString());
        double totalMoodScore = 0;
        int moodRecords = 0;
        for (Map<String, Object> row : moodRows) {
            LocalDateTime recordedAt = db.parseDateTime(row.get("recorded_at"));
            if (recordedAt == null) {
                continue;
            }
            int[] bucket = activityBuckets.get(recordedAt.toLocalDate());
            if (bucket != null) {
                bucket[2]++;
            }
            totalMoodScore += db.intValue(row.get("mood_score"), 0);
            moodRecords++;
        }

        List<Map<String, Object>> weeklyActivity = new ArrayList<>();
        for (Map.Entry<LocalDate, int[]> entry : activityBuckets.entrySet()) {
            int[] counts = entry.getValue();
            weeklyActivity.add(db.map(
                "date", entry.getKey().toString(),
                "day", shortWeekday(entry.getKey()),
                "followups", counts[0],
                "memory", counts[1],
                "mood_records", counts[2]
            ));
        }

        double avgMoodScore = moodRecords == 0 ? 0 : Math.round(totalMoodScore / moodRecords * 10.0) / 10.0;
        return ok(db.map(
            "family_id", familyId,
            "months", normalizedMonths,
            "days", normalizedDays,
            "summary", db.map(
                "total_users", elderlyUsers + familyUsers,
                "elderly_users", elderlyUsers,
                "family_users", familyUsers,
                "followups", followupRows.size(),
                "media_plays", mediaPlayRows.size(),
                "mood_records", moodRecords,
                "avg_mood_score", avgMoodScore
            ),
            "user_growth", userGrowth,
            "weekly_activity", weeklyActivity
        ));
    }

    public ResponseEntity<Map<String, Object>> getCounselors() {
        List<Map<String, Object>> counselors = db.list("SELECT * FROM counselors WHERE is_active = 1 ORDER BY available DESC, rating DESC, id ASC");
        counselors.forEach(item -> item.put("available", db.boolValue(item.get("available"))));
        return ok("counselors", counselors);
    }
    public ResponseEntity<Map<String, Object>> getConsultations(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("c.family_id = ?", familyId);
        addEquals(query, "c.elderly_id", params.get("elderly_id"));
        int limit = intParam(params, "limit", 20);
        List<Object> args = query.argsList();
        args.add(limit);
        List<Map<String, Object>> consultations = db.list("""
            SELECT c.*, co.name AS counselor_name, co.title AS counselor_title, co.avatar AS counselor_avatar
            FROM consultations c
            LEFT JOIN counselors co ON c.counselor_id = co.id
            WHERE %s
            ORDER BY c.scheduled_time DESC
            LIMIT ?
            """.formatted(query.where), args.toArray());
        return ok("consultations", consultations);
    }
    public ResponseEntity<Map<String, Object>> createConsultation(Map<String, Object> data) {
        if (!has(data, "family_id", "scheduled_time")) {
            return bad("missing required fields");
        }
        long id = db.insert("""
            INSERT INTO consultations (family_id, elderly_id, counselor_id, consultation_type, scheduled_time, duration, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("elderly_id"), data.get("counselor_id"),
            value(data, "consultation_type", "phone"), data.get("scheduled_time"), value(data, "duration", 45),
            value(data, "status", "scheduled"), value(data, "note", ""));
        return created(db.map("success", true, "consultation_id", id));
    }
    public ResponseEntity<Map<String, Object>> updateConsultation(long consultationId, Map<String, Object> data) {
        return familyScopedUpdate(
            "consultations",
            consultationId,
            db.string(data.get("family_id")),
            data,
            List.of("consultation_type", "scheduled_time", "duration", "status", "note", "counselor_id"),
            "consultation",
            false
        );
    }
    public ResponseEntity<Map<String, Object>> uploadMedia(MultipartFile file,
                                                           String family_id,
                                                           String title,
                                                           String description,
                                                           Long uploaded_by) {
        try {
            if (file.isEmpty() || file.getOriginalFilename() == null || !allowedFile(file.getOriginalFilename())) {
                return bad("unsupported or empty file");
            }
            Files.createDirectories(properties.uploadDir);
            Files.createDirectories(properties.uploadDir.resolve("thumbnails"));
            String ext = extension(file.getOriginalFilename());
            String filename = java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSSSSS").format(LocalDateTime.now()) + "." + ext;
            Path target = properties.uploadDir.resolve(filename);
            file.transferTo(target);
            String mediaType = List.of("mp4", "mov", "avi").contains(ext) ? "video" : "photo";
            Path thumbnail = "video".equals(mediaType) ? generateVideoThumbnail(target, filename) : generatePhotoThumbnail(target, filename);
            long id = db.insert("""
                INSERT INTO media (family_id, media_type, title, description, file_path, file_size, thumbnail_path, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, family_id, mediaType, title, description, target.toString(), Files.size(target), thumbnail == null ? null : thumbnail.toString(), uploaded_by);
            db.insert("INSERT INTO media_policies (media_id, time_windows, moods, occasions, cooldown, priority) VALUES (?, ?, ?, ?, ?, ?)", id, "[]", "[]", "[]", 60, 5);
            return created(db.map("success", true, "media_id", id, "file_path", target.toString(), "media_type", mediaType));
        } catch (Exception ex) {
            return status(HttpStatus.INTERNAL_SERVER_ERROR, db.map("error", "upload failed: " + ex.getMessage()));
        }
    }
    public ResponseEntity<Map<String, Object>> getFamilyMedia(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> rows = db.list("""
            SELECT m.*, p.time_windows, p.moods, p.occasions, p.cooldown, p.priority, p.play_count, p.last_played_at,
                   (SELECT GROUP_CONCAT(tag) FROM media_tags t WHERE t.media_id = m.id) AS tags
            FROM media m
            LEFT JOIN media_policies p ON m.id = p.media_id
            WHERE m.family_id = ? AND m.is_active = 1
            ORDER BY m.created_at DESC
            """, family_id);
        rows.forEach(this::normalizeMediaRow);
        return ok("media", rows);
    }
    public ResponseEntity<Map<String, Object>> getMediaDetail(long mediaId, String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> media = db.one("""
            SELECT m.*, p.time_windows, p.moods, p.occasions, p.cooldown, p.priority, p.play_count, p.last_played_at
            FROM media m
            LEFT JOIN media_policies p ON m.id = p.media_id
            WHERE m.id = ? AND m.family_id = ? AND m.is_active = 1
            """, mediaId, familyId).orElse(null);
        if (media == null) {
            return notFound("media not found");
        }
        normalizeMediaRow(media);
        media.put("tags", db.list("SELECT tag FROM media_tags WHERE media_id = ?", mediaId).stream().map(row -> row.get("tag")).toList());
        media.put("statistics", db.one("""
            SELECT COUNT(*) AS total_plays,
                   SUM(CASE WHEN feedback_type = 'like' THEN 1 ELSE 0 END) AS likes,
                   SUM(CASE WHEN feedback_type = 'dislike' THEN 1 ELSE 0 END) AS dislikes
            FROM media_play_history mph
            LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
            WHERE mph.media_id = ?
            """, mediaId).orElseGet(LinkedHashMap::new));
        media.put("history", db.list("""
            SELECT mph.id, mph.elderly_id, u.name AS elderly_name, mph.played_at, mph.duration_watched, mph.completed,
                   mph.triggered_by, mph.mood_before, mph.mood_after, mf.feedback_type
            FROM media_play_history mph
            LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
            LEFT JOIN users u ON mph.elderly_id = u.id
            WHERE mph.media_id = ?
            ORDER BY mph.played_at DESC
            LIMIT 10
            """, mediaId));
        return ok(media);
    }
    public ResponseEntity<Map<String, Object>> updateMedia(long mediaId, Map<String, Object> data) {
        String familyId = db.string(data.get("family_id"));
        ResponseEntity<Map<String, Object>> guard = requireFamilyRecord("media", mediaId, familyId, "media");
        if (guard != null) {
            return guard;
        }
        if (data.containsKey("title") || data.containsKey("description")) {
            Map<String, Object> mediaData = new LinkedHashMap<>();
            if (data.containsKey("title")) {
                mediaData.put("title", data.get("title"));
            }
            if (data.containsKey("description")) {
                mediaData.put("description", data.get("description"));
            }
            ResponseEntity<Map<String, Object>> mediaUpdate = familyScopedUpdate(
                "media",
                mediaId,
                familyId,
                mediaData,
                List.of("title", "description"),
                "media"
            );
            if (!HttpStatus.OK.equals(mediaUpdate.getStatusCode())) {
                return mediaUpdate;
            }
        }
        if (data.containsKey("tags")) {
            db.update("DELETE FROM media_tags WHERE media_id = ?", mediaId);
            for (Object tag : db.jsonList(data.get("tags"))) {
                db.insert("INSERT INTO media_tags (media_id, tag) VALUES (?, ?)", mediaId, tag);
            }
        }
        List<String> policyFields = List.of("time_windows", "moods", "occasions", "cooldown", "priority");
        Map<String, Object> policyData = new LinkedHashMap<>();
        for (String field : policyFields) {
            if (data.containsKey(field)) {
                policyData.put(field, List.of("time_windows", "moods", "occasions").contains(field) ? db.toJson(data.get(field)) : data.get(field));
            }
        }
        if (!policyData.isEmpty()) {
            dynamicUpdateByColumn("media_policies", "media_id", mediaId, policyData, policyFields);
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> deleteMedia(long mediaId, String familyId) {
        return softDeleteFamilyRecord("media", mediaId, familyId, "media");
    }
    public ResponseEntity<Map<String, Object>> getRecommendedMedia(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String mood = params.getOrDefault("mood", "");
        String occasion = params.getOrDefault("occasion", "");
        Set<String> requiredTags = new LinkedHashSet<>();
        if (!blank(params.get("tags"))) {
            Arrays.stream(params.get("tags").split(",")).map(String::trim).filter(s -> !s.isBlank()).forEach(requiredTags::add);
        }
        LocalTime now = LocalTime.now(properties.zoneId);
        List<Map<String, Object>> rows = db.list("""
            SELECT m.*, p.time_windows, p.moods, p.occasions, p.cooldown, p.priority, p.play_count, p.last_played_at,
                   (SELECT GROUP_CONCAT(tag) FROM media_tags t WHERE t.media_id = m.id) AS tags
            FROM media m
            INNER JOIN media_policies p ON m.id = p.media_id
            WHERE m.family_id = ? AND m.is_active = 1
            ORDER BY p.priority DESC, p.play_count ASC
            """, familyId);
        List<Map<String, Object>> recommended = new ArrayList<>();
        Set<String> allTags = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            normalizeMediaRow(row);
            List<Object> tags = db.jsonList(row.get("tags"));
            tags.forEach(tag -> allTags.add(String.valueOf(tag)));
            if (!requiredTags.isEmpty() && !tags.stream().map(String::valueOf).collect(java.util.stream.Collectors.toSet()).containsAll(requiredTags)) {
                continue;
            }
            if (!matchesTimeWindows(db.jsonList(row.get("time_windows")), now)) {
                continue;
            }
            List<Object> moods = db.jsonList(row.get("moods"));
            if (!moods.isEmpty() && !blank(mood) && !moods.contains(mood)) {
                continue;
            }
            List<Object> occasions = db.jsonList(row.get("occasions"));
            if (!occasions.isEmpty() && !blank(occasion) && !occasions.contains(occasion)) {
                continue;
            }
            recommended.add(row);
        }
        return ok(db.map("media", recommended, "available_tags", allTags.stream().sorted().toList()));
    }
    public ResponseEntity<Map<String, Object>> recordMediaPlay(long mediaId, Map<String, Object> data) {
        if (!data.containsKey("elderly_id")) {
            return bad("missing elderly_id");
        }
        db.insert("""
            INSERT INTO media_play_history (media_id, elderly_id, duration_watched, completed, triggered_by, mood_before, mood_after)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, mediaId, data.get("elderly_id"), value(data, "duration_watched", 0), value(data, "completed", 0),
            value(data, "triggered_by", "manual"), value(data, "mood_before", ""), value(data, "mood_after", ""));
        db.update("UPDATE media_policies SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE media_id = ?", mediaId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> submitMediaFeedback(long mediaId, Map<String, Object> data) {
        long elderlyId = db.longValue(data.get("elderly_id"), 0);
        String type = db.string(data.get("feedback_type"));
        if (elderlyId <= 0 || !List.of("like", "dislike").contains(type)) {
            return bad("invalid parameters");
        }
        db.upsertMediaFeedback(mediaId, elderlyId, type);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> getMediaHistory(Long elderly_id,
                                                               int limit) {
        if (elderly_id == null) {
            return bad("missing elderly_id");
        }
        return ok("history", db.list("""
            SELECT mph.*, m.title, m.media_type, m.file_path, m.thumbnail_path, mf.feedback_type
            FROM media_play_history mph
            INNER JOIN media m ON mph.media_id = m.id
            LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
            WHERE mph.elderly_id = ?
            ORDER BY mph.played_at DESC
            LIMIT ?
            """, elderly_id, limit));
    }
    public ResponseEntity<Map<String, Object>> getRecentPlays(String family_id,
                                                              int limit) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        return ok("recent_plays", db.list("""
            SELECT m.id, m.title, m.media_type, m.thumbnail_path, mph.played_at,
                   COUNT(CASE WHEN mf.feedback_type = 'like' THEN 1 END) AS likes,
                   COUNT(CASE WHEN mf.feedback_type = 'dislike' THEN 1 END) AS dislikes
            FROM media m
            INNER JOIN media_play_history mph ON m.id = mph.media_id
            LEFT JOIN media_feedback mf ON m.id = mf.media_id
            WHERE m.family_id = ?
            GROUP BY m.id, m.title, m.media_type, m.thumbnail_path, mph.played_at
            ORDER BY mph.played_at DESC
            LIMIT ?
            """, family_id, limit));
    }
    public ResponseEntity<Map<String, Object>> createToast(Map<String, Object> data) {
        String familyId = db.string(data.get("family_id"));
        String message = db.string(data.get("message"));
        if (familyId.isBlank() || message.isBlank()) {
            return bad("missing required parameters");
        }
        Map<String, Object> toast = toastService.create(familyId, db.string(value(data, "type", "info")), message, db.intValue(value(data, "duration", 3000), 3000));
        return created(db.map("success", true, "toast_id", toast.get("id")));
    }
    public ResponseEntity<Map<String, Object>> pollToast(String family_id) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        return ok(toastService.poll(family_id));
    }
    public SseEmitter toastStream(String family_id) {
        return toastService.stream(family_id);
    }
    public ResponseEntity<Map<String, Object>> aiChat(Map<String, Object> data,
                                                      HttpHeaders headers) {
        try {
            Map<String, Object> body = data == null ? Map.of() : data;
            return ok(aiCompanion.chat(db.string(value(body, "message", value(body, "text", ""))), db.string(value(body, "user", "User")), origin(headers)));
        } catch (IllegalArgumentException ex) {
            return bad(ex.getMessage());
        } catch (Exception ex) {
            return status(HttpStatus.SERVICE_UNAVAILABLE, db.map("error", ex.getMessage()));
        }
    }
    public ResponseEntity<Map<String, Object>> aiVoiceChat(MultipartFile file,
                                                           MultipartFile voice,
                                                           MultipartFile audio,
                                                           String user,
                                                           HttpHeaders headers) {
        try {
            Map<String, Object> result = aiCompanion.voiceChat(file != null ? file : (voice != null ? voice : audio), user, origin(headers));
            if (result.containsKey("error")) {
                return status(HttpStatus.UNPROCESSABLE_ENTITY, result);
            }
            return ok(result);
        } catch (IllegalArgumentException ex) {
            return bad(ex.getMessage());
        } catch (Exception ex) {
            return status(HttpStatus.INTERNAL_SERVER_ERROR, db.map("error", ex.getMessage()));
        }
    }
    public ResponseEntity<Map<String, Object>> aiSpeak(Map<String, Object> data,
                                                       HttpHeaders headers) {
        try {
            Map<String, Object> body = data == null ? Map.of() : data;
            return ok(aiCompanion.speak(db.string(value(body, "text", "")), db.string(value(body, "user", "User")), origin(headers)));
        } catch (IllegalArgumentException ex) {
            return bad(ex.getMessage());
        }
    }
    public ResponseEntity<Map<String, Object>> health() {
        return ok(db.map("status", "ok", "timestamp", LocalDateTime.now().toString(), "backend", "java-spring-boot"));
    }

    private long insertAlert(Map<String, Object> data, String source) {
        return db.insert("""
            INSERT INTO family_alerts (family_id, elderly_id, alert_type, level, title, message, metadata, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("elderly_id"), data.get("alert_type"), data.get("level"),
            data.get("title"), data.get("message"), db.toJson(value(data, "metadata", Map.of())), source);
    }

    private ResponseEntity<Map<String, Object>> dynamicUpdate(String table, long id, Map<String, Object> data, List<String> allowed) {
        return dynamicUpdateByColumn(table, "id", id, data, allowed);
    }

    private ResponseEntity<Map<String, Object>> familyScopedUpdate(String table,
                                                                   long id,
                                                                   String familyId,
                                                                   Map<String, Object> data,
                                                                   List<String> allowed,
                                                                   String resourceName) {
        return familyScopedUpdate(table, id, familyId, data, allowed, resourceName, true);
    }

    private ResponseEntity<Map<String, Object>> familyScopedUpdate(String table,
                                                                   long id,
                                                                   String familyId,
                                                                   Map<String, Object> data,
                                                                   List<String> allowed,
                                                                   String resourceName,
                                                                   boolean requireActive) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        for (String field : allowed) {
            if (data.containsKey(field)) {
                sets.add(field + " = ?");
                args.add(data.get(field));
            }
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(id);
        args.add(familyId);
        String where = "id = ? AND family_id = ?" + (requireActive ? " AND is_active = 1" : "");
        int updated = db.update("UPDATE " + table + " SET " + String.join(", ", sets) + " WHERE " + where, args.toArray());
        if (updated == 0) {
            return notFound(resourceName + " not found");
        }
        return ok(db.ok());
    }

    private ResponseEntity<Map<String, Object>> softDeleteFamilyRecord(String table,
                                                                       long id,
                                                                       String familyId,
                                                                       String resourceName) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        int updated = db.update(
            "UPDATE " + table + " SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ? AND is_active = 1",
            id,
            familyId
        );
        if (updated == 0) {
            return notFound(resourceName + " not found");
        }
        return ok(db.ok());
    }

    private ResponseEntity<Map<String, Object>> requireFamilyRecord(String table,
                                                                    long id,
                                                                    String familyId,
                                                                    String resourceName) {
        return requireFamilyRecord(table, "id", id, familyId, resourceName, true);
    }

    private ResponseEntity<Map<String, Object>> requireFamilyRecord(String table,
                                                                    String idColumn,
                                                                    long id,
                                                                    String familyId,
                                                                    String resourceName,
                                                                    boolean requireActive) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String sql = "SELECT " + idColumn + " FROM " + table + " WHERE " + idColumn + " = ? AND family_id = ?"
            + (requireActive ? " AND is_active = 1" : "");
        if (db.one(sql, id, familyId).isEmpty()) {
            return notFound(resourceName + " not found");
        }
        return null;
    }

    private ResponseEntity<Map<String, Object>> dynamicUpdateByColumn(String table, String idColumn, long id, Map<String, Object> data, List<String> allowed) {
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        for (String field : allowed) {
            if (data.containsKey(field)) {
                sets.add(field + " = ?");
                args.add(data.get(field));
            }
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(id);
        db.update("UPDATE " + table + " SET " + String.join(", ", sets) + " WHERE " + idColumn + " = ?", args.toArray());
        return ok(db.ok());
    }

    private void normalizeMessageBooleans(List<Map<String, Object>> messages) {
        for (Map<String, Object> msg : messages) {
            msg.put("played", db.boolValue(msg.get("played")));
            msg.put("liked", db.boolValue(msg.get("liked")));
        }
    }

    private void normalizeMediaRow(Map<String, Object> row) {
        Object tags = row.get("tags");
        if (tags instanceof String tagText && !tagText.isBlank()) {
            row.put("tags", Arrays.stream(tagText.split(",")).filter(s -> !s.isBlank()).toList());
        } else if (!(tags instanceof List<?>)) {
            row.put("tags", List.of());
        }
        for (String field : List.of("time_windows", "moods", "occasions")) {
            row.put(field, db.jsonList(row.get(field)));
        }
    }

    private boolean matchesTimeWindows(List<Object> windows, LocalTime now) {
        if (windows.isEmpty()) {
            return true;
        }
        for (Object item : windows) {
            String text = String.valueOf(item);
            if (!text.contains("-")) {
                continue;
            }
            String[] parts = text.split("-", 2);
            try {
                LocalTime start = LocalTime.parse(parts[0]);
                LocalTime end = LocalTime.parse(parts[1]);
                if (!now.isBefore(start) && !now.isAfter(end)) {
                    return true;
                }
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private List<Map<String, Object>> buildServiceCases(String familyId) {
        List<Map<String, Object>> elderlyUsers = db.list("""
            SELECT id, name, phone
            FROM users
            WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
            ORDER BY created_at ASC, id ASC
            """, familyId);
        List<Map<String, Object>> familyContacts = db.list("""
            SELECT id, name, phone
            FROM users
            WHERE family_id = ? AND user_type = 'family' AND is_active = 1
            ORDER BY created_at ASC, id ASC
            """, familyId);
        Map<String, Object> primaryContact = familyContacts.isEmpty() ? null : familyContacts.get(0);
        List<Map<String, Object>> alerts = db.list("""
            SELECT id, elderly_id, level, handled, created_at
            FROM family_alerts
            WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
            ORDER BY created_at DESC, id DESC
            """, familyId);
        Map<Long, Map<String, Object>> latestMoodByElderly = loadLatestMoodByElderly(familyId);

        List<Map<String, Object>> cases = new ArrayList<>();
        for (Map<String, Object> elderly : elderlyUsers) {
            long elderlyId = db.longValue(elderly.get("id"), 0);
            int openAlertCount = 0;
            boolean hasHighAlert = false;
            boolean hasMediumAlert = false;
            Map<String, Object> latestAlert = null;
            for (Map<String, Object> alert : alerts) {
                if (db.longValue(alert.get("elderly_id"), 0) != elderlyId) {
                    continue;
                }
                if (latestAlert == null) {
                    latestAlert = alert;
                }
                if (!db.boolValue(alert.get("handled"))) {
                    openAlertCount++;
                    String level = db.string(alert.get("level")).trim().toLowerCase();
                    if ("high".equals(level)) {
                        hasHighAlert = true;
                    } else if ("medium".equals(level)) {
                        hasMediumAlert = true;
                    }
                }
            }

            Map<String, Object> latestMood = latestMoodByElderly.get(elderlyId);
            Integer latestMoodScore = latestMood == null ? null : db.intValue(latestMood.get("mood_score"), 10);
            String risk = computeCaseRiskLevel(latestMoodScore, openAlertCount, hasHighAlert, hasMediumAlert);
            cases.add(db.map(
                "elderly_id", elderlyId,
                "name", db.string(elderly.get("name")),
                "phone", db.string(elderly.get("phone")),
                "family_contact_name", primaryContact == null ? "" : db.string(primaryContact.get("name")),
                "family_contact_phone", primaryContact == null ? "" : db.string(primaryContact.get("phone")),
                "risk", risk,
                "last_emotion", describeMood(latestMood),
                "last_emotion_score", latestMoodScore == null ? 0 : latestMoodScore,
                "last_help_at", latestAlert == null ? "" : db.string(latestAlert.get("created_at")),
                "open_alert_count", openAlertCount,
                "latest_alert_id", latestAlert == null ? null : db.longValue(latestAlert.get("id"), 0)
            ));
        }

        cases.sort((left, right) -> {
            int riskCompare = Integer.compare(riskPriority(db.string(left.get("risk"))), riskPriority(db.string(right.get("risk"))));
            if (riskCompare != 0) {
                return riskCompare;
            }
            return Integer.compare(db.intValue(right.get("open_alert_count"), 0), db.intValue(left.get("open_alert_count"), 0));
        });
        return cases;
    }

    private Map<Long, Map<String, Object>> loadLatestMoodByElderly(String familyId) {
        Map<Long, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : db.list("""
            SELECT m.elderly_id, m.mood_type, m.mood_score, m.recorded_at
            FROM mood_records m
            JOIN (
                SELECT elderly_id, MAX(recorded_at) AS latest_recorded_at
                FROM mood_records
                WHERE family_id = ?
                GROUP BY elderly_id
            ) latest ON latest.elderly_id = m.elderly_id AND latest.latest_recorded_at = m.recorded_at
            WHERE m.family_id = ?
            ORDER BY m.recorded_at DESC, m.id DESC
            """, familyId, familyId)) {
            long elderlyId = db.longValue(row.get("elderly_id"), 0);
            if (elderlyId > 0 && !result.containsKey(elderlyId)) {
                result.put(elderlyId, row);
            }
        }
        return result;
    }

    private Map<Long, Integer> loadLatestMoodScoreByElderly(String familyId) {
        Map<Long, Integer> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<String, Object>> entry : loadLatestMoodByElderly(familyId).entrySet()) {
            result.put(entry.getKey(), db.intValue(entry.getValue().get("mood_score"), 10));
        }
        return result;
    }

    private String describeMood(Map<String, Object> mood) {
        if (mood == null) {
            return "暂无记录";
        }
        return moodTypeLabel(db.string(mood.get("mood_type"))) + " " + db.intValue(mood.get("mood_score"), 0) + "分";
    }

    private String moodTypeLabel(String moodType) {
        return switch (moodType) {
            case "happy" -> "开心";
            case "calm" -> "平稳";
            case "sad" -> "难过";
            case "anxious" -> "焦虑";
            case "angry" -> "生气";
            case "tired" -> "疲惫";
            default -> blank(moodType) ? "暂无记录" : moodType;
        };
    }

    private String normalizePriority(String level) {
        return switch (db.string(level).trim().toLowerCase()) {
            case "high" -> "high";
            case "medium" -> "medium";
            default -> "low";
        };
    }

    private String serviceAlertTypeLabel(String type) {
        return switch (db.string(type).trim().toLowerCase()) {
            case "sos_emergency" -> "紧急求助";
            case "contact_family" -> "联系家人";
            case "medication" -> "用药提醒";
            case "emotion" -> "情绪波动";
            case "inactive" -> "长时间未活动";
            case "emergency" -> "异常事件";
            default -> "服务工单";
        };
    }

    private boolean isActiveConsultationStatus(String status) {
        return "scheduled".equals(status) || "in_progress".equals(status);
    }

    private int riskPriority(String riskLevel) {
        return switch (riskLevel) {
            case "high" -> 0;
            case "medium" -> 1;
            default -> 2;
        };
    }

    private String shortWeekday(LocalDate date) {
        return switch (date.getDayOfWeek().getValue()) {
            case 1 -> "周一";
            case 2 -> "周二";
            case 3 -> "周三";
            case 4 -> "周四";
            case 5 -> "周五";
            case 6 -> "周六";
            default -> "周日";
        };
    }

    private Map<String, Object> weatherPayload(Object codeValue, Object temperatureValue, String source) {
        int code = db.intValue(codeValue, -999);
        String icon = "☁";
        String label = "天气";
        if (code == 0) {
            icon = "☀";
            label = "晴";
        } else if (code == 1 || code == 2) {
            icon = "🌤";
            label = "少云";
        } else if (code == 3) {
            label = "阴";
        } else if (List.of(61, 63, 65, 66, 67, 80, 81, 82).contains(code)) {
            icon = "🌧";
            label = "雨";
        } else if (List.of(71, 73, 75, 77, 85, 86).contains(code)) {
            icon = "❄";
            label = "雪";
        }
        String temperature = "";
        if (temperatureValue instanceof Number number) {
            temperature = " " + Math.round(number.doubleValue()) + "°C";
        }
        return db.map("icon", icon, "text", "fallback".equals(source) ? "天气待同步" : (label + temperature).trim(),
            "source", source, "weather_code", codeValue, "temperature", temperatureValue);
    }

    private Map<String, Object> rowsToCountMap(List<Map<String, Object>> rows, String keyColumn) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(db.string(row.get(keyColumn)), row.get("count"));
        }
        return result;
    }

    private void roundAvg(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            Object avg = row.get("avg_score");
            if (avg instanceof Number number) {
                row.put("avg_score", Math.round(number.doubleValue() * 10.0) / 10.0);
            } else {
                row.put("avg_score", 0);
            }
        }
    }

    private Path generatePhotoThumbnail(Path source, String filename) {
        try {
            BufferedImage image = ImageIO.read(source.toFile());
            if (image == null) {
                return null;
            }
            int width = image.getWidth();
            int height = image.getHeight();
            double scale = Math.min(320.0 / width, 320.0 / height);
            scale = Math.min(scale, 1.0);
            int targetWidth = Math.max(1, (int) Math.round(width * scale));
            int targetHeight = Math.max(1, (int) Math.round(height * scale));
            BufferedImage thumb = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = thumb.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(image, 0, 0, targetWidth, targetHeight, null);
            g.dispose();
            Path target = properties.uploadDir.resolve("thumbnails").resolve(filename.replaceFirst("\\.[^.]+$", "_thumb.jpg"));
            ImageIO.write(thumb, "jpg", target.toFile());
            return target;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Path generateVideoThumbnail(Path source, String filename) {
        Path target = properties.uploadDir.resolve("thumbnails").resolve(filename.replaceFirst("\\.[^.]+$", "_thumb.jpg"));
        try {
            Process process = new ProcessBuilder("ffmpeg", "-i", source.toString(), "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=320:-1", "-y", target.toString())
                .redirectErrorStream(true)
                .start();
            if (process.waitFor() == 0 && Files.isRegularFile(target)) {
                return target;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private boolean allowedFile(String filename) {
        String ext = extension(filename);
        return List.of("png", "jpg", "jpeg", "gif", "mp4", "mov", "avi").contains(ext);
    }

    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot + 1).toLowerCase() : "";
    }

    private Object value(Map<String, Object> map, String key, Object fallback) {
        Object value = map.get(key);
        return value == null ? fallback : value;
    }

    private boolean has(Map<String, Object> data, String... fields) {
        if (data == null) {
            return false;
        }
        for (String field : fields) {
            if (!data.containsKey(field) || data.get(field) == null || data.get(field).toString().isBlank()) {
                return false;
            }
        }
        return true;
    }

    private void addEquals(QueryParts query, String column, String value) {
        if (!blank(value)) {
            query.add(column + " = ?", value);
        }
    }

    private void addBooleanFilter(QueryParts query, String column, String value) {
        if ("true".equalsIgnoreCase(value)) {
            query.add(column + " = 1");
        } else if ("false".equalsIgnoreCase(value)) {
            query.add(column + " = 0");
        }
    }

    private int intParam(Map<String, String> params, String key, int fallback) {
        try {
            return Integer.parseInt(params.getOrDefault(key, Integer.toString(fallback)));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String origin(HttpHeaders headers) {
        String host = headers.getFirst(HttpHeaders.HOST);
        String forwardedProto = headers.getFirst("X-Forwarded-Proto");
        String scheme = blank(forwardedProto) ? "http" : forwardedProto;
        return blank(host) ? "http://127.0.0.1:8000" : scheme + "://" + host;
    }

    private String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String nextBindingCode() {
        for (int attempt = 0; attempt < 8; attempt++) {
            String candidate = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
            if (db.one("SELECT id FROM users WHERE binding_code = ? LIMIT 1", candidate).isEmpty()) {
                return candidate;
            }
        }
        return UUID.randomUUID().toString().replace("-", "").toUpperCase();
    }

    private ResponseEntity<Map<String, Object>> loginUser(String userType, String username, String password) {
        Map<String, Object> user = db.one("""
            SELECT id, user_type, name, phone, family_id, binding_code
            FROM users
            WHERE user_type = ? AND is_active = 1 AND (name = ? OR phone = ?)
            ORDER BY created_at
            LIMIT 1
            """, userType, username, username).orElse(null);
        if (user == null) {
            return notFound("account not found");
        }
        if (!matchesLoginPassword(user, password)) {
            return unauthorized("username or password is incorrect");
        }

        long userId = db.longValue(user.get("id"), 0);
        String familyId = db.string(user.get("family_id"));
        Map<String, Object> body = db.map(
            "success", true,
            "role", userType,
            "user_id", userId,
            "display_name", user.get("name"),
            "family_id", familyId
        );

        if ("elderly".equals(userType)) {
            body.put("elderly_id", userId);
            body.put("elderly_name", user.get("name"));
        } else {
            body.put("family_user_id", userId);
            body.put("family_name", user.get("name"));
            Map<String, Object> elderly = db.one("""
                SELECT id, name
                FROM users
                WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
                ORDER BY created_at
                LIMIT 1
                """, familyId).orElse(null);
            if (elderly != null) {
                body.put("elderly_id", elderly.get("id"));
                body.put("elderly_name", elderly.get("name"));
            }
        }

        return ok(body);
    }

    private ResponseEntity<Map<String, Object>> loginOperator(String role,
                                                              String username,
                                                              String password,
                                                              String expectedUsername,
                                                              String expectedPassword,
                                                              String displayName) {
        if (!expectedUsername.equalsIgnoreCase(username) || !expectedPassword.equals(password)) {
            return unauthorized("username or password is incorrect");
        }

        Map<String, Object> body = db.map(
            "success", true,
            "role", role,
            "username", username,
            "display_name", displayName
        );
        if ("service".equals(role)) {
            body.put("family_id", properties.serviceFamilyId);
        }
        return ok(body);
    }

    private boolean matchesLoginPassword(Map<String, Object> user, String password) {
        String phone = db.string(user.get("phone")).replaceAll("\\D+", "");
        if (phone.length() >= 6 && password.equals(phone.substring(phone.length() - 6))) {
            return true;
        }
        return password.equals(properties.demoLoginPassword);
    }

    private String computeCaseRiskLevel(Integer moodScore, long openAlertCount, boolean hasHighAlert, boolean hasMediumAlert) {
        if (hasHighAlert || openAlertCount >= 2 || (moodScore != null && moodScore <= 4)) {
            return "high";
        }
        if (hasMediumAlert || openAlertCount >= 1 || (moodScore != null && moodScore <= 6)) {
            return "medium";
        }
        return "low";
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private ResponseEntity<Map<String, Object>> ok(String key, Object value) {
        return ok(db.map(key, value));
    }

    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> body) {
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> created(Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    private ResponseEntity<Map<String, Object>> bad(String message) {
        return status(HttpStatus.BAD_REQUEST, db.map("error", message));
    }

    private ResponseEntity<Map<String, Object>> notFound(String message) {
        return status(HttpStatus.NOT_FOUND, db.map("error", message));
    }

    private ResponseEntity<Map<String, Object>> unauthorized(String message) {
        return status(HttpStatus.UNAUTHORIZED, db.map("error", message));
    }

    private ResponseEntity<Map<String, Object>> status(HttpStatus status, Map<String, Object> body) {
        return ResponseEntity.status(status).body(body);
    }

    private static final class QueryParts {
        private String where;
        private final List<Object> args = new ArrayList<>();

        QueryParts(String where, Object... args) {
            this.where = where;
            this.args.addAll(Arrays.asList(args));
        }

        void add(String condition, Object... values) {
            where += " AND " + condition;
            args.addAll(Arrays.asList(values));
        }

        Object[] args() {
            return args.toArray();
        }

        List<Object> argsList() {
            return new ArrayList<>(args);
        }
    }
}
