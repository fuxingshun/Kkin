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
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
        return dynamicUpdate("schedules", scheduleId, data, allowed);
    }
    public ResponseEntity<Map<String, Object>> deleteSchedule(long scheduleId) {
        db.update("UPDATE schedules SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", scheduleId);
        return ok(db.ok());
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
        Map<String, Object> body = data == null ? Map.of() : data;
        db.update("""
            UPDATE family_alerts
            SET handled = 1, handled_at = CURRENT_TIMESTAMP, handled_by = ?, reply_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, body.get("handled_by"), body.get("reply_message"), alertId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> markAlertRead(long alertId) {
        db.update("UPDATE family_alerts SET " + db.readColumn() + " = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", alertId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> replyAlert(long alertId, Map<String, Object> data) {
        if (!data.containsKey("reply_message")) {
            return bad("missing reply_message");
        }
        db.update("UPDATE family_alerts SET reply_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", data.get("reply_message"), alertId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> deleteAlert(long alertId) {
        db.update("UPDATE family_alerts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", alertId);
        return ok(db.ok());
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
    public ResponseEntity<Map<String, Object>> deleteMessage(long messageId) {
        db.update("UPDATE family_messages SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", messageId);
        return ok(db.ok());
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
        List<Map<String, Object>> all = db.list("""
            SELECT * FROM family_messages
            WHERE family_id = ? AND is_active = 1 AND played = 0
            ORDER BY scheduled_time ASC
            """, family_id);
        List<Map<String, Object>> pending = new ArrayList<>();
        for (Map<String, Object> msg : all) {
            LocalDateTime scheduled = db.parseDateTime(msg.get("scheduled_time"));
            if (scheduled != null && !scheduled.isAfter(now)) {
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
        long id = db.insert("""
            INSERT INTO mood_records (family_id, elderly_id, mood_type, mood_score, note, source, trigger_event, location, weather, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("elderly_id"), moodType, score, value(data, "note", ""),
            value(data, "source", "manual"), value(data, "trigger_event", ""), value(data, "location", ""),
            value(data, "weather", ""), value(data, "recorded_at", db.nowString()));
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
    public ResponseEntity<Map<String, Object>> completeReminder(long reminderId) {
        db.update("UPDATE reminders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", reminderId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> dismissReminder(long reminderId) {
        db.update("UPDATE reminders SET status = 'dismissed' WHERE id = ?", reminderId);
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> updateScheduleStatus(long scheduleId, Map<String, Object> data) {
        String status = db.string(data.get("status"));
        if (!List.of("pending", "completed", "skipped", "missed").contains(status)) {
            return bad("invalid status");
        }
        if ("completed".equals(status)) {
            db.update("UPDATE schedules SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, scheduleId);
        } else {
            db.update("UPDATE schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, scheduleId);
        }
        return ok(db.ok());
    }
    public ResponseEntity<Map<String, Object>> createUser(Map<String, Object> data) {
        if (!has(data, "user_type", "name", "family_id")) {
            return bad("missing required fields");
        }
        long id = db.insert("INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)",
            data.get("user_type"), data.get("name"), value(data, "phone", ""), data.get("family_id"));
        return created(db.map("success", true, "user_id", id));
    }
    public ResponseEntity<Map<String, Object>> getFamilyUsers(String familyId) {
        return ok("users", db.list("SELECT * FROM users WHERE family_id = ? ORDER BY user_type, created_at", familyId));
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
        return dynamicUpdate("consultations", consultationId, data, List.of("consultation_type", "scheduled_time", "duration", "status", "note", "counselor_id"));
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
    public ResponseEntity<Map<String, Object>> getMediaDetail(long mediaId) {
        Map<String, Object> media = db.one("""
            SELECT m.*, p.time_windows, p.moods, p.occasions, p.cooldown, p.priority, p.play_count, p.last_played_at
            FROM media m LEFT JOIN media_policies p ON m.id = p.media_id WHERE m.id = ?
            """, mediaId).orElse(null);
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
        if (data.containsKey("title") || data.containsKey("description")) {
            dynamicUpdate("media", mediaId, data, List.of("title", "description"));
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
    public ResponseEntity<Map<String, Object>> deleteMedia(long mediaId) {
        db.update("UPDATE media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", mediaId);
        return ok(db.ok());
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
