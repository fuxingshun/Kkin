package com.kinecho.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.mapper.KinEchoMapper;
import com.kinecho.server.security.PasswordHasher;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.FileSystemResource;
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
import java.sql.Timestamp;
import java.time.Duration;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class KinEchoApiService {
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Set<String> AUTH_ACCOUNT_ROLES = Set.of("admin", "service", "counselor", "family", "elderly");
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
            case "service" -> loginOperator("service", username, password);
            case "admin" -> loginOperator("admin", username, password);
            default -> bad("invalid role");
        };
    }

    public ResponseEntity<Map<String, Object>> me(String sessionToken, String authorization) {
        String token = extractSessionToken(sessionToken, authorization);
        if (blank(token)) {
            return unauthorized("missing session token");
        }

        Map<String, Object> payload = verifySessionToken(token);
        if (payload == null) {
            return unauthorized("invalid session token");
        }

        String role = db.string(payload.get("role"));
        Map<String, Object> user = db.map(
            "role", role,
            "user_id", payload.get("user_id"),
            "username", payload.get("username"),
            "display_name", payload.get("display_name"),
            "openid", payload.get("openid")
        );

        String familyId = db.string(payload.get("family_id"));
        if (!blank(familyId)) {
            user.put("family_id", familyId);
        }
        if (payload.containsKey("family_ids")) {
            user.put("family_ids", payload.get("family_ids"));
        }
        if (payload.containsKey("organization_id")) {
            user.put("organization_id", payload.get("organization_id"));
        }
        if (payload.containsKey("permissions")) {
            user.put("permissions", payload.get("permissions"));
        }
        if (payload.containsKey("elderly_id")) {
            user.put("elderly_id", payload.get("elderly_id"));
            user.put("elderly_name", payload.get("elderly_name"));
        }
        if (payload.containsKey("family_user_id")) {
            user.put("family_user_id", payload.get("family_user_id"));
            user.put("family_name", payload.get("family_name"));
        }

        return ok(db.map(
            "success", true,
            "role", role,
            "user", user,
            "family_id", familyId,
            "family_ids", payload.get("family_ids"),
            "organization_id", payload.get("organization_id"),
            "permissions", payload.get("permissions"),
            "elderly_id", payload.get("elderly_id"),
            "elderly_bound", payload.containsKey("elderly_id"),
            "session_expires_at", payload.get("exp")
        ));
    }

    public ResponseEntity<Map<String, Object>> wechatLogin(Map<String, Object> data) {
        if (!has(data, "role", "code")) {
            return bad("missing required fields");
        }

        String role = db.string(data.get("role")).trim().toLowerCase();
        String code = db.string(data.get("code")).trim();
        if (blank(code)) {
            return bad("wechat code is required");
        }

        if (!List.of("elderly", "family", "service").contains(role)) {
            return bad("invalid role");
        }

        try {
            WechatSession wechatSession = resolveWechatSession(role, code);
            Map<String, Object> userInfo = asMap(data.get("user_info"));
            return switch (role) {
                case "elderly" -> loginWechatUser("elderly", wechatSession, userInfo);
                case "family" -> loginWechatUser("family", wechatSession, userInfo);
                case "service" -> loginWechatService(wechatSession.openid());
                default -> bad("invalid role");
            };
        } catch (Exception error) {
            return status(HttpStatus.BAD_GATEWAY, db.map("error", "wechat login failed: " + error.getMessage()));
        }
    }

    public ResponseEntity<Map<String, Object>> wechatOpenid(Map<String, Object> data) {
        if (!has(data, "role", "code")) {
            return bad("missing required fields");
        }

        String role = db.string(data.get("role")).trim().toLowerCase();
        String code = db.string(data.get("code")).trim();
        if (!List.of("elderly", "family", "service").contains(role)) {
            return bad("invalid role");
        }
        if (blank(code)) {
            return bad("wechat code is required");
        }

        try {
            WechatSession wechatSession = resolveWechatSession(role, code);
            updateWechatProfileByOpenid(wechatSession, asMap(data.get("user_info")));
            return ok(db.map(
                "success", true,
                "openid", wechatSession.openid(),
                "unionid", wechatSession.unionid(),
                "selected_role", role
            ));
        } catch (Exception error) {
            return status(HttpStatus.BAD_GATEWAY, db.map("error", "wechat login failed: " + error.getMessage()));
        }
    }

    public ResponseEntity<Map<String, Object>> wechatIdentity(String openid) {
        String normalizedOpenid = db.string(openid).trim();
        if (blank(normalizedOpenid)) {
            return bad("missing openid");
        }

        Map<String, Object> elderly = identityUser(normalizedOpenid, "elderly");
        Map<String, Object> family = identityUser(normalizedOpenid, "family");
        Map<String, Object> service = serviceIdentity(normalizedOpenid);

        List<String> roles = new ArrayList<>();
        if (db.boolValue(elderly.get("has_role"))) {
            roles.add("elderly");
        }
        if (db.boolValue(family.get("has_role"))) {
            roles.add("family");
        }
        if (db.boolValue(service.get("has_role"))) {
            roles.add("service");
        }

        return ok(db.map(
            "success", true,
            "openid", normalizedOpenid,
            "roles", roles,
            "elderly", elderly,
            "family", family,
            "service", service
        ));
    }

    public ResponseEntity<Map<String, Object>> submitServiceCertification(Map<String, Object> data) {
        if (!has(data, "openid", "name", "phone", "staff_no", "organization")) {
            return bad("missing required fields");
        }

        String openid = db.string(data.get("openid")).trim();
        String name = db.string(data.get("name")).trim();
        String phone = db.string(data.get("phone")).trim();
        String staffNo = db.string(data.get("staff_no")).trim();
        String organization = db.string(data.get("organization")).trim();
        if (blank(openid) || blank(name) || blank(phone) || blank(staffNo) || blank(organization)) {
            return bad("certification fields cannot be blank");
        }

        Map<String, Object> existing = db.one("""
            SELECT id, status
            FROM service_certifications
            WHERE wechat_openid = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """, openid).orElse(null);

        if (existing == null) {
            db.insert("""
                INSERT INTO service_certifications (wechat_openid, name, phone, staff_no, organization, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
                """, openid, name, phone, staffNo, organization);
        } else {
            db.update("""
                UPDATE service_certifications
                SET name = ?, phone = ?, staff_no = ?, organization = ?, status = 'pending',
                    reviewed_at = NULL, reviewer = '', reject_reason = '', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, name, phone, staffNo, organization, existing.get("id"));
        }

        return ok(db.map("success", true, "status", "pending"));
    }

    public ResponseEntity<Map<String, Object>> getServiceCertifications(String status, int limit) {
        String normalizedStatus = db.string(status).trim().toLowerCase(Locale.ROOT);
        if (!blank(normalizedStatus) && !List.of("pending", "approved", "rejected").contains(normalizedStatus)) {
            return bad("unsupported status");
        }
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<Map<String, Object>> certifications = blank(normalizedStatus)
            ? db.list("""
                SELECT id, wechat_openid, name, phone, staff_no, organization, status,
                       reject_reason, reviewer, reviewed_at, created_at, updated_at
                FROM service_certifications
                ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at DESC, id DESC
                LIMIT ?
                """, safeLimit)
            : db.list("""
                SELECT id, wechat_openid, name, phone, staff_no, organization, status,
                       reject_reason, reviewer, reviewed_at, created_at, updated_at
                FROM service_certifications
                WHERE status = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT ?
                """, normalizedStatus, safeLimit);
        return ok(db.map(
            "certifications", certifications,
            "status", normalizedStatus,
            "limit", safeLimit,
            "total", certifications.size()
        ));
    }

    public ResponseEntity<Map<String, Object>> reviewServiceCertification(long certificationId, Map<String, Object> data) {
        if (certificationId <= 0) {
            return bad("invalid certification id");
        }
        Map<String, Object> body = data == null ? Map.of() : data;
        String status = db.string(body.get("status")).trim().toLowerCase(Locale.ROOT);
        if (!List.of("approved", "rejected").contains(status)) {
            return bad("status must be approved or rejected");
        }
        String reviewer = db.string(value(body, "reviewer", "admin")).trim();
        if (blank(reviewer)) {
            reviewer = "admin";
        }
        String rejectReason = db.string(value(body, "reject_reason", body.get("reason"))).trim();
        if ("rejected".equals(status) && blank(rejectReason)) {
            return bad("reject_reason is required");
        }
        int updated = db.update("""
            UPDATE service_certifications
            SET status = ?, reviewer = ?, reject_reason = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, status, reviewer, "approved".equals(status) ? "" : rejectReason, certificationId);
        if (updated == 0) {
            return notFound("service certification not found");
        }
        return ok(db.map(
            "success", true,
            "certification_id", certificationId,
            "status", status,
            "reviewer", reviewer,
            "reject_reason", "approved".equals(status) ? "" : rejectReason
        ));
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
        String source = db.string(value(data, "source", "elderly"));
        long id = insertAlert(data, source);
        auditCareAction(db.string(data.get("family_id")), data.get("elderly_id"), source, db.string(value(data, "created_by", source)),
            "alert_created", db.string(data.get("message")), db.map("alert_id", id, "payload", data));
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
        Map<String, Object> alert = db.one("SELECT elderly_id, title, message FROM family_alerts WHERE id = ? AND family_id = ? LIMIT 1",
            alertId, body.get("family_id")).orElse(Map.of());
        auditCareAction(db.string(body.get("family_id")), alert.get("elderly_id"), "family", db.string(value(body, "handled_by", "family")),
            "alert_handled", db.string(value(body, "reply_message", alert.get("message"))), db.map("alert_id", alertId, "payload", body));
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
        Map<String, Object> alert = db.one("SELECT elderly_id, title, message FROM family_alerts WHERE id = ? AND family_id = ? LIMIT 1",
            alertId, familyId).orElse(Map.of());
        auditCareAction(familyId, alert.get("elderly_id"), "family", "family", "alert_read",
            db.string(value(alert, "title", "预警已读")), db.map("alert_id", alertId));
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
        auditCareAction(db.string(data.get("family_id")), data.get("elderly_id"), "elderly", "elderly",
            "alert_created", db.string(data.get("message")), db.map("alert_id", id, "payload", data));
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
        auditCareAction(familyId, elderlyId, "elderly", "elderly", "mood_recorded",
            moodTypeLabel(moodType) + " " + score + "分", db.map("record_id", id, "payload", data));
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

    public ResponseEntity<Map<String, Object>> getElderlyProfileStats(String familyId, Long elderlyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> elderly = null;
        if (elderlyId != null && elderlyId > 0) {
            elderly = db.one("""
                SELECT id, name, created_at
                FROM users
                WHERE id = ? AND family_id = ? AND user_type = 'elderly' AND is_active = 1
                LIMIT 1
                """, elderlyId, familyId).orElse(null);
        }
        if (elderly == null) {
            elderly = db.one("""
                SELECT id, name, created_at
                FROM users
                WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                """, familyId).orElse(null);
        }
        if (elderly == null) {
            return notFound("elderly not found");
        }

        long resolvedElderlyId = db.longValue(elderly.get("id"), 0);
        LocalDateTime createdAt = db.parseDateTime(elderly.get("created_at"));
        long companionDays = 0;
        if (createdAt != null) {
            companionDays = Math.max(1, LocalDate.now(properties.zoneId).toEpochDay() - createdAt.toLocalDate().toEpochDay() + 1);
        }

        long moodCount = db.count("""
            SELECT COUNT(*)
            FROM mood_records
            WHERE family_id = ? AND elderly_id = ? AND (? IS NULL OR recorded_at >= ?)
            """, familyId, resolvedElderlyId, createdAt, createdAt);
        long mediaPlayCount = db.count("""
            SELECT COUNT(*)
            FROM media_play_history
            WHERE elderly_id = ? AND (? IS NULL OR played_at >= ?)
            """, resolvedElderlyId, createdAt, createdAt);
        long alertCount = db.count("""
            SELECT COUNT(*)
            FROM family_alerts
            WHERE family_id = ? AND elderly_id = ? AND source = 'elderly' AND is_active = 1
              AND (? IS NULL OR created_at >= ?)
            """, familyId, resolvedElderlyId, createdAt, createdAt);
        long playedMessageCount = db.count("""
            SELECT COUNT(*)
            FROM family_messages
            WHERE family_id = ? AND played = 1 AND is_active = 1
              AND (? IS NULL OR played_at >= ?)
            """, familyId, createdAt, createdAt);
        long aiInteractionCount = db.count("""
            SELECT COUNT(*)
            FROM ai_interactions
            WHERE username = ?
            """, elderlyChatUsername(familyId, resolvedElderlyId));
        long favoriteMemories = db.count("""
            SELECT COUNT(DISTINCT media_id)
            FROM media_feedback
            WHERE elderly_id = ? AND feedback_type = 'like' AND (? IS NULL OR created_at >= ?)
            """, resolvedElderlyId, createdAt, createdAt);

        return ok(db.map(
            "elderly_id", resolvedElderlyId,
            "elderly_name", elderly.get("name"),
            "companion_days", companionDays,
            "interaction_count", moodCount + mediaPlayCount + alertCount + playedMessageCount + aiInteractionCount,
            "favorite_memories", favoriteMemories,
            "created_at", elderly.get("created_at")
        ));
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

    public ResponseEntity<Map<String, Object>> getCareInsight(String familyId,
                                                              Long elderlyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        Map<String, Object> elderly = elderlyId != null && elderlyId > 0
            ? db.one("""
                SELECT id, name, phone
                FROM users
                WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1 AND id = ?
                LIMIT 1
                """, familyId, elderlyId).orElse(null)
            : db.one("""
                SELECT id, name, phone
                FROM users
                WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                """, familyId).orElse(null);
        if (elderly == null) {
            return notFound("elderly not found");
        }

        long resolvedElderlyId = db.longValue(elderly.get("id"), 0);
        String elderlyName = db.string(elderly.get("name"));
        LocalDateTime now = LocalDateTime.now(properties.zoneId);
        LocalDate today = now.toLocalDate();
        String sinceYesterday = now.minusDays(1).format(DATE_TIME);
        String sinceSevenDays = now.minusDays(7).format(DATE_TIME);

        Map<String, Object> latestMood = db.one("""
            SELECT *
            FROM mood_records
            WHERE family_id = ? AND elderly_id = ?
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
            """, familyId, resolvedElderlyId).orElse(null);
        Integer latestMoodScore = latestMood == null ? null : db.intValue(latestMood.get("mood_score"), 0);

        List<Map<String, Object>> alerts = db.list("""
            SELECT *
            FROM family_alerts
            WHERE family_id = ? AND elderly_id = ? AND is_active = 1 AND alert_type != 'media_display'
            ORDER BY created_at DESC, id DESC
            LIMIT 20
            """, familyId, resolvedElderlyId);
        List<Map<String, Object>> openAlerts = alerts.stream()
            .filter(item -> !db.boolValue(item.get("handled")))
            .toList();
        long openAlertCount = openAlerts.size();
        long highAlertCount = openAlerts.stream().filter(item -> "high".equals(db.string(item.get("level")))).count();
        boolean hasHighAlert = highAlertCount > 0;
        boolean hasMediumAlert = openAlerts.stream().anyMatch(item -> "medium".equals(db.string(item.get("level"))));

        List<Map<String, Object>> allSchedules = db.list("""
            SELECT *
            FROM schedules
            WHERE family_id = ? AND is_active = 1
            ORDER BY schedule_time ASC, id ASC
            """, familyId);
        int weekday = today.getDayOfWeek().getValue() % 7;
        List<Map<String, Object>> todaySchedules = allSchedules.stream()
            .filter(item -> {
                LocalDateTime scheduleTime = db.parseDateTime(item.get("schedule_time"));
                String repeat = db.string(value(item, "repeat_type", "once"));
                return switch (repeat) {
                    case "daily" -> true;
                    case "weekly" -> db.parseRepeatDays(item.get("repeat_days")).contains(weekday);
                    case "monthly" -> scheduleTime != null && scheduleTime.getDayOfMonth() == today.getDayOfMonth();
                    default -> scheduleTime != null && scheduleTime.toLocalDate().equals(today);
                };
            })
            .toList();
        long completedTasks = todaySchedules.stream()
            .filter(item -> "completed".equals(db.string(item.get("status"))))
            .count();
        int completionRate = todaySchedules.isEmpty()
            ? 0
            : (int) Math.round(completedTasks * 100.0 / todaySchedules.size());

        List<Map<String, Object>> pendingMessageRows = db.list("""
            SELECT scheduled_time
            FROM family_messages
            WHERE family_id = ? AND is_active = 1 AND played = 0
            """, familyId);
        long pendingMessages = pendingMessageRows.stream()
            .map(item -> db.parseDateTime(item.get("scheduled_time")))
            .filter(scheduled -> scheduled != null && scheduled.toLocalDate().equals(today) && !scheduled.isAfter(now))
            .count();
        long recentAiMessages = db.count("""
            SELECT COUNT(*)
            FROM ai_interactions
            WHERE username = 'User' AND type = 'member' AND created_at >= ?
            """, sinceYesterday);
        long recentMediaPlays = db.count("""
            SELECT COUNT(*)
            FROM media_play_history
            WHERE elderly_id = ? AND played_at >= ?
            """, resolvedElderlyId, sinceSevenDays);
        long activeFollowups = db.count("""
            SELECT COUNT(*)
            FROM consultations
            WHERE family_id = ? AND elderly_id = ? AND status IN ('scheduled', 'in_progress')
            """, familyId, resolvedElderlyId);
        Map<String, Object> latestServiceRecord = db.one("""
            SELECT note, scheduled_time, status
            FROM consultations
            WHERE family_id = ? AND elderly_id = ? AND note IS NOT NULL AND note != ''
            ORDER BY scheduled_time DESC, id DESC
            LIMIT 1
            """, familyId, resolvedElderlyId).orElse(null);

        String riskLevel = computeCaseRiskLevel(latestMoodScore, openAlertCount, hasHighAlert, hasMediumAlert);
        Map<String, Object> latestOpenAlert = openAlerts.isEmpty() ? null : openAlerts.get(0);
        String reason = careRiskReason(riskLevel, latestOpenAlert, latestMood, highAlertCount, openAlertCount,
            todaySchedules.size(), completionRate, pendingMessages);
        String nextStep = careNextStep(riskLevel, openAlertCount, todaySchedules.size(), completionRate, pendingMessages, activeFollowups);
        String moodText = latestMood == null
            ? "暂无情绪记录"
            : moodTypeLabel(db.string(latestMood.get("mood_type"))) + " " + latestMoodScore + "分";
        String latestServiceText = latestServiceRecord == null ? "" : db.string(latestServiceRecord.get("note"));
        Map<String, Object> metrics = db.map(
            "open_alerts", openAlertCount,
            "high_alerts", highAlertCount,
            "today_tasks", todaySchedules.size(),
            "completed_tasks", completedTasks,
            "completion_rate", completionRate,
            "mood_score", latestMoodScore,
            "pending_messages", pendingMessages,
            "recent_ai_messages", recentAiMessages,
            "recent_media_plays", recentMediaPlays,
            "active_followups", activeFollowups
        );

        return ok(db.map(
            "family_id", familyId,
            "elderly_id", resolvedElderlyId,
            "elderly_name", elderlyName,
            "risk_level", riskLevel,
            "status_label", careStatusLabel(riskLevel),
            "summary", elderlyName + "今日" + careStatusLabel(riskLevel) + "，情绪状态：" + moodText + "，任务完成率：" + completionRate + "%。",
            "reason", reason,
            "next_step", nextStep,
            "service_sop", careServiceSop(riskLevel, openAlertCount),
            "family_message", careFamilyMessage(riskLevel, reason, latestServiceText),
            "elderly_message", careElderlyMessage(riskLevel, pendingMessages),
            "latest_service_record", latestServiceText,
            "metrics", metrics,
            "generated_at", LocalDateTime.now(properties.zoneId).format(DATE_TIME)
        ));
    }

    public ResponseEntity<Map<String, Object>> recordConsent(Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String familyId = db.string(body.get("family_id"));
        String consentType = db.string(body.get("consent_type"));
        String version = db.string(value(body, "version", body.get("consent_version")));
        if (blank(familyId) || blank(consentType) || blank(version)) {
            return bad("missing required parameters");
        }

        Object elderlyId = normalizedElderlyId(body.get("elderly_id"));
        Object userId = normalizedElderlyId(body.get("user_id"));
        int accepted = consentAccepted(value(body, "accepted", true)) ? 1 : 0;
        String actorRole = db.string(value(body, "actor_role", "family"));
        String actorName = db.string(value(body, "actor_name", actorRole));
        String source = db.string(value(body, "source", "miniapp"));
        long id = db.insert("""
            INSERT INTO consent_records (
                family_id, elderly_id, user_id, consent_type, version, accepted,
                actor_role, actor_name, source, metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, familyId, elderlyId, userId, consentType, version, accepted,
            actorRole, actorName, source, db.toJson(value(body, "metadata", Map.of())));
        auditCareAction(familyId, elderlyId, actorRole, actorName, "consent_recorded",
            "记录用户同意" + consentType + "@" + version,
            db.map("consent_id", id, "accepted", accepted == 1, "source", source));
        return created(db.map("success", true, "consent_id", id));
    }

    public ResponseEntity<Map<String, Object>> getConsentRecords(String familyId, Long elderlyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> records = elderlyId != null && elderlyId > 0
            ? db.list("""
                SELECT * FROM consent_records
                WHERE family_id = ? AND elderly_id = ?
                ORDER BY created_at DESC
                LIMIT 100
                """, familyId, elderlyId)
            : db.list("""
                SELECT * FROM consent_records
                WHERE family_id = ?
                ORDER BY created_at DESC
                LIMIT 100
                """, familyId);
        return ok("consents", records);
    }

    public ResponseEntity<Map<String, Object>> exportFamilyData(String familyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("users", db.list("SELECT id, user_type, name, phone, family_id, binding_code, is_active, created_at, updated_at, deleted_at, deleted_by FROM users WHERE family_id = ? ORDER BY id", familyId));
        data.put("schedules", db.list("SELECT * FROM schedules WHERE family_id = ? ORDER BY schedule_time DESC", familyId));
        data.put("family_messages", db.list("SELECT * FROM family_messages WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("family_alerts", db.list("SELECT * FROM family_alerts WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("mood_records", db.list("SELECT * FROM mood_records WHERE family_id = ? ORDER BY recorded_at DESC", familyId));
        data.put("mental_screenings", db.list("SELECT * FROM mental_screenings WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("consultations", db.list("SELECT * FROM consultations WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("media", db.list("SELECT id, family_id, media_type, title, description, file_size, duration, uploaded_by, is_active, created_at, updated_at FROM media WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("consent_records", db.list("SELECT * FROM consent_records WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("privacy_requests", db.list("SELECT * FROM privacy_requests WHERE family_id = ? ORDER BY created_at DESC", familyId));
        data.put("care_audit_logs", db.list("SELECT * FROM care_audit_logs WHERE family_id = ? ORDER BY created_at DESC LIMIT 500", familyId));
        auditCareAction(familyId, null, "family", "family", "privacy_data_exported",
            "导出家庭数据", db.map("sections", data.keySet()));
        return ok(db.map(
            "success", true,
            "family_id", familyId,
            "exported_at", LocalDateTime.now(properties.zoneId).format(DATE_TIME),
            "data", data
        ));
    }

    public ResponseEntity<Map<String, Object>> createPrivacyRequest(Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String familyId = db.string(body.get("family_id"));
        String requestType = db.string(body.get("request_type"));
        if (blank(familyId) || blank(requestType)) {
            return bad("missing required parameters");
        }
        if (!List.of("export", "delete", "correction").contains(requestType)) {
            return bad("unsupported request_type");
        }
        Object elderlyId = normalizedElderlyId(body.get("elderly_id"));
        String requestedBy = db.string(value(body, "requested_by", "family"));
        String reason = db.string(value(body, "reason", ""));
        long id = db.insert("""
            INSERT INTO privacy_requests (family_id, elderly_id, request_type, status, requested_by, reason, metadata)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
            """, familyId, elderlyId, requestType, requestedBy, reason, db.toJson(value(body, "metadata", Map.of())));
        auditCareAction(familyId, elderlyId, "family", requestedBy, "privacy_request_created",
            "创建隐私请求" + requestType, db.map("request_id", id, "reason", reason));
        return created(db.map("success", true, "request_id", id, "status", "pending"));
    }

    public ResponseEntity<Map<String, Object>> getPrivacyRequests(String familyId, String status, int limit) {
        String normalizedStatus = db.string(status).trim().toLowerCase(Locale.ROOT);
        if (!blank(normalizedStatus) && !List.of("pending", "processing", "completed", "rejected").contains(normalizedStatus)) {
            return bad("unsupported status");
        }
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<Map<String, Object>> requests;
        if (blank(familyId) && blank(normalizedStatus)) {
            requests = db.list("""
                SELECT *
                FROM privacy_requests
                ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'processing' THEN 1 ELSE 2 END,
                         updated_at DESC, id DESC
                LIMIT ?
                """, safeLimit);
        } else if (blank(familyId)) {
            requests = db.list("""
                SELECT *
                FROM privacy_requests
                WHERE status = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT ?
                """, normalizedStatus, safeLimit);
        } else if (blank(normalizedStatus)) {
            requests = db.list("""
                SELECT *
                FROM privacy_requests
                WHERE family_id = ?
                ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'processing' THEN 1 ELSE 2 END,
                         updated_at DESC, id DESC
                LIMIT ?
                """, familyId, safeLimit);
        } else {
            requests = db.list("""
                SELECT *
                FROM privacy_requests
                WHERE family_id = ? AND status = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT ?
                """, familyId, normalizedStatus, safeLimit);
        }
        return ok(db.map("requests", requests, "family_id", familyId, "status", normalizedStatus, "limit", safeLimit, "total", requests.size()));
    }

    public ResponseEntity<Map<String, Object>> reviewPrivacyRequest(long requestId, Map<String, Object> data) {
        if (requestId <= 0) {
            return bad("invalid request id");
        }
        Map<String, Object> body = data == null ? Map.of() : data;
        String status = db.string(body.get("status")).trim().toLowerCase(Locale.ROOT);
        if (!List.of("processing", "completed", "rejected").contains(status)) {
            return bad("status must be processing, completed or rejected");
        }
        String reviewer = db.string(value(body, "reviewer", "admin")).trim();
        if (blank(reviewer)) {
            reviewer = "admin";
        }
        String processNote = db.string(value(body, "process_note", body.get("reason"))).trim();
        if ("rejected".equals(status) && blank(processNote)) {
            return bad("process_note is required");
        }

        Map<String, Object> current = db.one("""
            SELECT id, family_id, elderly_id, request_type, status
            FROM privacy_requests
            WHERE id = ?
            LIMIT 1
            """, requestId).orElse(null);
        if (current == null) {
            return notFound("privacy request not found");
        }

        int updated = db.update("""
            UPDATE privacy_requests
            SET status = ?, processed_by = ?, process_note = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, status, reviewer, processNote, requestId);
        if (updated == 0) {
            return notFound("privacy request not found");
        }

        String familyId = db.string(current.get("family_id"));
        auditCareAction(familyId, current.get("elderly_id"), "admin", reviewer, "privacy_request_reviewed",
            "隐私请求处理为 " + status,
            db.map("request_id", requestId, "request_type", current.get("request_type"), "previous_status", current.get("status"), "process_note", processNote));
        return ok(db.map("success", true, "request_id", requestId, "status", status, "reviewer", reviewer, "process_note", processNote));
    }

    public ResponseEntity<Map<String, Object>> getAdminAuthAccounts(String role,
                                                                    String familyId,
                                                                    String status,
                                                                    int limit,
                                                                    String sessionToken,
                                                                    String authorization) {
        ResponseEntity<Map<String, Object>> guard = requireAdminSession(sessionToken, authorization, "admin:auth");
        if (guard != null) {
            return guard;
        }
        String normalizedRole = db.string(role).trim().toLowerCase(Locale.ROOT);
        if (!blank(normalizedRole) && !AUTH_ACCOUNT_ROLES.contains(normalizedRole)) {
            return bad("invalid role");
        }
        String normalizedStatus = db.string(status).trim().toLowerCase(Locale.ROOT);
        if (!blank(normalizedStatus) && !List.of("active", "disabled", "locked").contains(normalizedStatus)) {
            return bad("status must be active, disabled or locked");
        }
        int safeLimit = Math.max(1, Math.min(limit, 500));
        StringBuilder sql = new StringBuilder("""
            SELECT id, role, username, display_name, permissions, user_id, organization_id, family_id,
                   disabled, failed_login_count, session_version, locked_until, last_login_at, created_by, updated_by, created_at, updated_at
            FROM auth_accounts
            WHERE 1 = 1
            """);
        List<Object> args = new ArrayList<>();
        if (!blank(normalizedRole)) {
            sql.append(" AND role = ?");
            args.add(normalizedRole);
        }
        String normalizedFamilyId = db.string(familyId).trim();
        if (!blank(normalizedFamilyId)) {
            sql.append(" AND family_id = ?");
            args.add(normalizedFamilyId);
        }
        if ("active".equals(normalizedStatus)) {
            sql.append(" AND disabled = 0 AND (locked_until IS NULL OR locked_until <= CURRENT_TIMESTAMP)");
        } else if ("disabled".equals(normalizedStatus)) {
            sql.append(" AND disabled = 1");
        } else if ("locked".equals(normalizedStatus)) {
            sql.append(" AND locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP");
        }
        sql.append(" ORDER BY role, username LIMIT ?");
        args.add(safeLimit);
        List<Map<String, Object>> accounts = db.list(sql.toString(), args.toArray());
        return ok(db.map("accounts", accounts, "role", normalizedRole, "family_id", normalizedFamilyId, "status", normalizedStatus, "limit", safeLimit, "total", accounts.size()));
    }

    public ResponseEntity<Map<String, Object>> createAdminAuthAccount(Map<String, Object> data, String sessionToken, String authorization) {
        ResponseEntity<Map<String, Object>> guard = requireAdminSession(sessionToken, authorization, "admin:auth");
        if (guard != null) {
            return guard;
        }
        if (data == null) {
            return bad("missing account data");
        }
        String role = db.string(data.get("role")).trim().toLowerCase(Locale.ROOT);
        String username = db.string(data.get("username")).trim();
        String password = db.string(data.get("password"));
        if (!AUTH_ACCOUNT_ROLES.contains(role)) {
            return bad("invalid role");
        }
        if (blank(username) || username.length() > 191) {
            return bad("username is required");
        }
        if (!strongAccountPassword(password)) {
            return bad("password must be at least 12 characters");
        }

        String displayName = db.string(value(data, "display_name", username)).trim();
        String organizationId = db.string(value(data, "organization_id", "")).trim();
        String familyId = db.string(value(data, "family_id", "")).trim();
        long userId = db.longValue(value(data, "user_id", 0), 0);
        if (List.of("elderly", "family").contains(role)) {
            if (userId <= 0) {
                return bad("user_id is required for elderly and family accounts");
            }
            Map<String, Object> user = db.one("""
                SELECT id, family_id
                FROM users
                WHERE id = ? AND user_type = ? AND is_active = 1
                LIMIT 1
                """, userId, role).orElse(null);
            if (user == null) {
                return bad("bound user must be active and match role");
            }
            if (blank(familyId)) {
                familyId = db.string(user.get("family_id"));
            }
        }

        String operator = db.string(value(data, "operator", "admin")).trim();
        if (blank(operator)) {
            operator = "admin";
        }
        List<String> permissions = permissionsFromRequest(data.get("permissions"), role);
        int disabled = db.boolValue(value(data, "disabled", false)) ? 1 : 0;
        long accountId = db.insert("""
            INSERT INTO auth_accounts (
                role, username, display_name, password_hash, permissions, user_id, organization_id, family_id,
                disabled, failed_login_count, created_by, updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            role, username, displayName, PasswordHasher.hash(password), db.toJson(permissions), userId <= 0 ? null : userId,
            organizationId, familyId, disabled, operator, operator);
        auditAuthAction(accountId, role, username, "admin_account_created", true, "", familyId);
        return created(db.map("success", true, "account_id", accountId, "role", role, "username", username, "family_id", familyId, "user_id", userId));
    }

    public ResponseEntity<Map<String, Object>> updateAdminAuthAccount(long accountId, Map<String, Object> data, String sessionToken, String authorization) {
        ResponseEntity<Map<String, Object>> guard = requireAdminSession(sessionToken, authorization, "admin:auth");
        if (guard != null) {
            return guard;
        }
        if (accountId <= 0) {
            return bad("invalid account id");
        }
        if (data == null || data.isEmpty()) {
            return bad("missing account update data");
        }
        Map<String, Object> account = db.one("""
            SELECT id, role, username, family_id
            FROM auth_accounts
            WHERE id = ?
            LIMIT 1
            """, accountId).orElse(null);
        if (account == null) {
            return notFound("auth account not found");
        }

        boolean updatesPassword = data.containsKey("password") && !blank(db.string(data.get("password")));
        boolean updatesDisabled = data.containsKey("disabled");
        boolean unlocksAccount = db.boolValue(value(data, "unlock", false));
        if ((updatesPassword || updatesDisabled || unlocksAccount) && !confirmedAdminAction(data)) {
            return bad("confirmation is required for password, disabled or unlock changes");
        }

        String role = db.string(account.get("role"));
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (data.containsKey("display_name")) {
            sets.add("display_name = ?");
            args.add(db.string(data.get("display_name")).trim());
        }
        if (data.containsKey("permissions")) {
            sets.add("permissions = ?");
            args.add(db.toJson(permissionsFromRequest(data.get("permissions"), role)));
        }
        if (data.containsKey("organization_id")) {
            sets.add("organization_id = ?");
            args.add(db.string(data.get("organization_id")).trim());
        }
        if (data.containsKey("family_id")) {
            sets.add("family_id = ?");
            args.add(db.string(data.get("family_id")).trim());
        }
        if (data.containsKey("user_id")) {
            long userId = db.longValue(data.get("user_id"), 0);
            if (List.of("elderly", "family").contains(role) && userId <= 0) {
                return bad("user_id is required for elderly and family accounts");
            }
            sets.add("user_id = ?");
            args.add(userId <= 0 ? null : userId);
        }
        if (updatesDisabled) {
            sets.add("disabled = ?");
            args.add(db.boolValue(data.get("disabled")) ? 1 : 0);
        }
        if (updatesPassword) {
            String password = db.string(data.get("password"));
            if (!strongAccountPassword(password)) {
                return bad("password must be at least 12 characters");
            }
            sets.add("password_hash = ?");
            args.add(PasswordHasher.hash(password));
            sets.add("failed_login_count = 0");
            sets.add("locked_until = NULL");
        }
        if (unlocksAccount) {
            sets.add("failed_login_count = 0");
            sets.add("locked_until = NULL");
        }
        boolean affectsIssuedSessions = updatesPassword
            || updatesDisabled
            || unlocksAccount
            || data.containsKey("permissions")
            || data.containsKey("organization_id")
            || data.containsKey("family_id")
            || data.containsKey("user_id");
        if (affectsIssuedSessions) {
            sets.add("session_version = COALESCE(session_version, 1) + 1");
        }
        if (sets.isEmpty()) {
            return bad("no supported account fields to update");
        }

        String operator = db.string(value(data, "operator", "admin")).trim();
        if (blank(operator)) {
            operator = "admin";
        }
        sets.add("updated_by = ?");
        args.add(operator);
        args.add(accountId);
        db.update("UPDATE auth_accounts SET " + String.join(", ", sets) + ", updated_at = CURRENT_TIMESTAMP WHERE id = ?", args.toArray());
        String familyId = db.string(value(data, "family_id", account.get("family_id")));
        auditAuthAction(accountId, role, db.string(account.get("username")), "admin_account_updated", true, "", familyId);
        return ok(db.map("success", true, "account_id", accountId, "role", role, "updated_by", operator));
    }

    public ResponseEntity<Map<String, Object>> createLiveMentalScreening(MultipartFile frame,
                                                                         String familyId,
                                                                         Long elderlyId,
                                                                         int frameCount,
                                                                         int completedActions,
                                                                         int livenessScore,
                                                                         int qualityScore,
                                                                         String consentVersion) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        if (elderlyId == null || elderlyId <= 0) {
            return bad("missing elderly_id");
        }
        UploadSecurityValidator.Result validation = UploadSecurityValidator.validate(frame, UploadSecurityValidator.Profile.MENTAL_FRAME);
        if (!validation.accepted()) {
            return bad(validation.message());
        }

        Map<String, Object> elderly = db.one("""
            SELECT id, name
            FROM users
            WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1 AND id = ?
            LIMIT 1
            """, familyId, elderlyId).orElse(null);
        if (elderly == null) {
            return notFound("elderly not found");
        }

        try {
            Path dir = properties.uploadDir.resolve("mental-screenings");
            Files.createDirectories(dir);
            String ext = validation.extension();
            String filename = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSSSSS").format(LocalDateTime.now(properties.zoneId))
                + "-" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            Path target = dir.resolve(filename).toAbsolutePath().normalize();
            frame.transferTo(target);
            String framePath = "mental-screenings/" + filename;

            int normalizedFrameCount = Math.max(1, Math.min(frameCount, 8));
            int normalizedActions = Math.max(0, Math.min(completedActions, 4));
            int normalizedLiveness = clampScore(livenessScore <= 0 ? normalizedActions * 25 : livenessScore);
            int normalizedQuality = clampScore(qualityScore <= 0 ? 80 : qualityScore);
            Map<String, Object> analysis = mentalScreeningAnalysis(normalizedActions, normalizedLiveness, normalizedQuality);

            long id = db.insert("""
                INSERT INTO mental_screenings (
                    family_id, elderly_id, capture_mode, risk_level, risk_score, status_label, summary, recommendation,
                    frame_path, frame_count, completed_actions, liveness_score, quality_score, consent_version, source
                )
                VALUES (?, ?, 'live_camera', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'elderly')
                """,
                familyId,
                elderlyId,
                analysis.get("risk_level"),
                analysis.get("risk_score"),
                analysis.get("status_label"),
                analysis.get("summary"),
                analysis.get("recommendation"),
                framePath,
                normalizedFrameCount,
                normalizedActions,
                normalizedLiveness,
                normalizedQuality,
                blank(consentVersion) ? "mental-screening-live-v1" : consentVersion
            );

            Long alertId = null;
            String riskLevel = db.string(analysis.get("risk_level"));
            if ("medium".equals(riskLevel) || "high".equals(riskLevel)) {
                String level = "high".equals(riskLevel) ? "high" : "medium";
                Map<String, Object> alertData = db.map(
                    "family_id", familyId,
                    "elderly_id", elderlyId,
                    "alert_type", "emotion",
                    "level", level,
                    "title", "心理关怀筛查提醒",
                    "message", analysis.get("recommendation"),
                    "metadata", db.map("screening_id", id, "risk_score", analysis.get("risk_score"), "source", "live_camera")
                );
                alertId = insertAlert(alertData, "system");
            }

            auditCareAction(familyId, elderlyId, "elderly", "elderly", "mental_screening_created",
                db.string(analysis.get("summary")), db.map("screening_id", id, "frame_count", normalizedFrameCount, "alert_id", alertId));

            Map<String, Object> record = mentalScreeningRecord(id);
            record.put("alert_id", alertId);
            record.put("disclaimer", "本结果仅用于健康关怀和风险筛查参考，不作为医学诊断。");
            return created(record);
        } catch (IOException error) {
            return status(HttpStatus.INTERNAL_SERVER_ERROR, db.map("error", "failed to save mental screening frame"));
        }
    }

    public ResponseEntity<Map<String, Object>> getLatestMentalScreening(String familyId, Long elderlyId) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("ms.family_id = ? AND ms.is_active = 1", familyId);
        if (elderlyId != null && elderlyId > 0) {
            query.add("ms.elderly_id = ?", elderlyId);
        }
        Map<String, Object> record = db.one("""
            SELECT ms.*, u.name AS elderly_name
            FROM mental_screenings ms
            LEFT JOIN users u ON ms.elderly_id = u.id
            WHERE %s
            ORDER BY ms.created_at DESC, ms.id DESC
            LIMIT 1
            """.formatted(query.where), query.args()).orElse(null);
        return ok(db.map("record", record));
    }

    public ResponseEntity<Map<String, Object>> getMentalScreenings(String familyId, Long elderlyId, int limit) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("ms.family_id = ? AND ms.is_active = 1", familyId);
        if (elderlyId != null && elderlyId > 0) {
            query.add("ms.elderly_id = ?", elderlyId);
        }
        List<Object> args = query.argsList();
        args.add(Math.max(1, Math.min(limit, 50)));
        List<Map<String, Object>> records = db.list("""
            SELECT ms.*, u.name AS elderly_name
            FROM mental_screenings ms
            LEFT JOIN users u ON ms.elderly_id = u.id
            WHERE %s
            ORDER BY ms.created_at DESC, ms.id DESC
            LIMIT ?
            """.formatted(query.where), args.toArray());
        return ok(db.map("records", records));
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
        auditCareAction(familyId, data.get("elderly_id"), "elderly", "elderly", "schedule_status_updated",
            "照护任务状态更新为 " + status, db.map("schedule_id", scheduleId, "payload", data));
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
        long id = db.insert("""
            INSERT INTO users (user_type, name, phone, family_id, binding_code, wechat_openid, is_active, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            userType, data.get("name"), value(data, "phone", ""), data.get("family_id"), bindingCode,
            value(data, "wechat_openid", ""),
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
        String wechatOpenid = db.string(value(data, "wechat_openid", "")).trim();

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
                SET name = ?, phone = ?, wechat_openid = COALESCE(NULLIF(?, ''), wechat_openid),
                    updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND is_active = 1
                """, name, phone, wechatOpenid, operator, userId);
        } else {
            userId = db.insert("""
                INSERT INTO users (user_type, name, phone, family_id, binding_code, wechat_openid, is_active, created_by, updated_by)
                VALUES ('family', ?, ?, ?, '', ?, 1, ?, ?)
                """, name, phone, familyId, wechatOpenid, operator, operator);
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
            Map<String, Object> task = db.map(
                "id", db.longValue(row.get("id"), 0),
                "alert_id", db.longValue(row.get("alert_id"), 0),
                "elderly_id", db.longValue(row.get("elderly_id"), 0),
                "elderly_name", blank(db.string(row.get("elderly_name"))) ? "未绑定老人" : db.string(row.get("elderly_name")),
                "type_label", blank(db.string(row.get("title"))) ? serviceAlertTypeLabel(db.string(row.get("alert_type"))) : db.string(row.get("title")),
                "reason", db.string(row.get("message")),
                "priority", normalizePriority(db.string(row.get("level"))),
                "status", taskStatus,
                "created_at", db.string(row.get("created_at"))
            );
            attachServiceTaskSla(task, row, taskStatus);
            tasks.add(task);
        }
        return ok(db.map("tasks", tasks, "limit", limit, "total", tasks.size()));
    }

    private void attachServiceTaskSla(Map<String, Object> task,
                                      Map<String, Object> source,
                                      String taskStatus) {
        String level = db.string(source.get("level"));
        String alertType = db.string(source.get("alert_type"));
        int slaMinutes = serviceTaskSlaMinutes(level, alertType);
        LocalDateTime createdAt = db.parseDateTime(source.get("created_at"));
        LocalDateTime deadline = createdAt == null ? null : createdAt.plusMinutes(slaMinutes);
        LocalDateTime now = LocalDateTime.now(properties.zoneId);
        boolean completed = "completed".equals(taskStatus);
        boolean overdue = deadline != null && !completed && now.isAfter(deadline);
        long remainingMinutes = deadline == null || completed ? 0 : Duration.between(now, deadline).toMinutes();
        task.put("sla_minutes", slaMinutes);
        task.put("sla_deadline_at", deadline == null ? "" : deadline.format(DATE_TIME));
        task.put("overdue", overdue);
        task.put("remaining_minutes", remainingMinutes);
        task.put("escalation_hint", serviceTaskEscalationHint(overdue, remainingMinutes, normalizePriority(level)));
    }

    private int serviceTaskSlaMinutes(String level, String alertType) {
        if ("ai_crisis".equals(alertType) || "sos_emergency".equals(alertType) || "emergency".equals(alertType)) {
            return 15;
        }
        return switch (normalizePriority(level)) {
            case "high" -> 30;
            case "medium" -> 120;
            default -> 1440;
        };
    }

    private String serviceTaskEscalationHint(boolean overdue, long remainingMinutes, String priority) {
        if (overdue) {
            return "已超时，请优先联系家属并补充处理记录";
        }
        if ("high".equals(priority) && remainingMinutes <= 10) {
            return "高风险工单即将超时，请尽快处理";
        }
        if ("medium".equals(priority) && remainingMinutes <= 30) {
            return "中风险工单接近处理时限";
        }
        return "";
    }

    public ResponseEntity<Map<String, Object>> startServiceTask(long alertId) {
        Map<String, Object> alert = db.one("SELECT family_id, elderly_id, message FROM family_alerts WHERE id = ? LIMIT 1", alertId).orElse(Map.of());
        db.update("""
            UPDATE family_alerts
            SET %s = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """.formatted(db.readColumn()), alertId);
        auditCareAction(db.string(alert.get("family_id")), alert.get("elderly_id"), "service", "service",
            "service_task_started", db.string(value(alert, "message", "服务人员开始处理工单")), db.map("alert_id", alertId));
        return ok(db.map("success", true, "alert_id", alertId, "status", "processing"));
    }

    public ResponseEntity<Map<String, Object>> completeServiceTask(long alertId,
                                                                   Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String replyMessage = db.string(value(body, "reply_message", "服务端已完成处理"));
        Map<String, Object> alert = db.one("SELECT family_id, elderly_id FROM family_alerts WHERE id = ? LIMIT 1", alertId).orElse(Map.of());
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
        auditCareAction(db.string(alert.get("family_id")), alert.get("elderly_id"), "service", "service",
            "service_task_completed", replyMessage, db.map("alert_id", alertId, "payload", body));
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
        Map<String, Object> insight = getCareInsight(familyId, elderlyId).getBody();

        return ok(db.map(
            "family_id", familyId,
            "case_info", caseInfo,
            "alerts", alerts,
            "mood_records", moodRecords,
            "mood_trend", moodTrend,
            "consultations", consultations,
            "family_contacts", familyContacts,
            "insight", insight
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
        followups.forEach(this::attachConsultationFamilySummary);
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
        auditCareAction(db.string(data.get("family_id")), data.get("elderly_id"), "service", "service",
            "followup_created", db.string(value(data, "note", "创建随访任务")), db.map("consultation_id", id, "payload", data));
        return created(db.map("success", true, "consultation_id", id));
    }

    public ResponseEntity<Map<String, Object>> updateServiceFollowupStatus(long consultationId,
                                                                           Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String familyId = db.string(body.get("family_id"));
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        String status = normalizeConsultationStatus(db.string(body.get("status")));
        if (!List.of("scheduled", "in_progress", "completed", "cancelled").contains(status)) {
            return bad("invalid status");
        }
        Map<String, Object> current = db.one("""
            SELECT id, family_id, elderly_id, status, scheduled_time, note
            FROM consultations
            WHERE id = ? AND family_id = ?
            LIMIT 1
            """, consultationId, familyId).orElse(null);
        if (current == null) {
            return notFound("consultation not found");
        }
        ResponseEntity<Map<String, Object>> lifecycleCheck = validateConsultationLifecycle(current, body);
        if (lifecycleCheck != null) {
            return lifecycleCheck;
        }
        int updated = db.update("""
            UPDATE consultations
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND family_id = ?
            """, status, consultationId, familyId);
        if (updated == 0) {
            return notFound("consultation not found");
        }
        auditCareAction(familyId, current.get("elderly_id"), "service", "service", "followup_status_updated",
            "随访状态更新为 " + status, db.map("consultation_id", consultationId, "payload", body));
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
        auditCareAction(familyId, data.get("elderly_id"), "service", "service", "service_record_created",
            content, db.map("consultation_id", consultationId, "alert_id", alertId > 0 ? alertId : null, "payload", data));

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

    public ResponseEntity<Map<String, Object>> getAdminFamilies() {
        List<Map<String, Object>> families = db.list("""
            SELECT
                u.family_id,
                COUNT(*) AS total_users,
                SUM(CASE WHEN u.user_type = 'elderly' THEN 1 ELSE 0 END) AS elderly_count,
                SUM(CASE WHEN u.user_type = 'family' THEN 1 ELSE 0 END) AS family_count,
                COALESCE(a.open_alerts, 0) AS open_alerts
            FROM users u
            LEFT JOIN (
                SELECT family_id, COUNT(*) AS open_alerts
                FROM family_alerts
                WHERE is_active = 1 AND handled = 0 AND alert_type != 'media_display'
                GROUP BY family_id
            ) a ON a.family_id = u.family_id
            WHERE u.is_active = 1
            GROUP BY u.family_id, a.open_alerts
            ORDER BY u.family_id ASC
            """);

        return ok(db.map("families", families));
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
        counselors.forEach(this::normalizeCounselor);
        return ok("counselors", counselors);
    }

    public ResponseEntity<Map<String, Object>> getAdminCounselors() {
        List<Map<String, Object>> counselors = db.list("""
            SELECT *
            FROM counselors
            ORDER BY is_active DESC, available DESC, rating DESC, id ASC
            """);
        counselors.forEach(this::normalizeCounselor);
        return ok("counselors", counselors);
    }

    public ResponseEntity<Map<String, Object>> updateAdminCounselor(long counselorId, Map<String, Object> data) {
        if (counselorId <= 0) {
            return bad("invalid counselor id");
        }
        Map<String, Object> body = data == null ? Map.of() : data;
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (body.containsKey("available")) {
            sets.add("available = ?");
            args.add(activeFlag(body.get("available"), 1));
        }
        if (body.containsKey("is_active")) {
            sets.add("is_active = ?");
            args.add(activeFlag(body.get("is_active"), 1));
        }
        if (body.containsKey("availability_text")) {
            sets.add("availability_text = ?");
            args.add(db.string(body.get("availability_text")).trim());
        }
        if (body.containsKey("calendar")) {
            sets.add("calendar = ?");
            args.add(db.toJson(value(body, "calendar", Map.of())));
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(counselorId);
        int updated = db.update("UPDATE counselors SET " + String.join(", ", sets) + " WHERE id = ?", args.toArray());
        if (updated == 0) {
            return notFound("counselor not found");
        }
        return ok(db.map("success", true, "counselor_id", counselorId));
    }

    private void normalizeCounselor(Map<String, Object> item) {
        item.put("available", db.boolValue(item.get("available")));
        item.put("price", db.intValue(item.get("price"), 300));
        item.put("discount_price", db.intValue(item.get("discount_price"), 210));
        item.put("tags", db.jsonList(item.get("tags")).stream().map(String::valueOf).toList());
        item.put("experience_stats", db.jsonMap(item.get("experience_stats")));
        item.put("specialties", db.jsonList(item.get("specialties")));
        item.put("packages", db.jsonList(item.get("packages")));
        Map<String, Object> calendar = db.jsonMap(item.get("calendar"));
        item.put("calendar", calendar);
        item.put("notices", db.jsonList(item.get("notices")));
        attachCounselorAvailabilitySummary(item, calendar);
    }

    private void attachCounselorAvailabilitySummary(Map<String, Object> item, Map<String, Object> calendar) {
        int slotCount = 0;
        String nextAvailableText = "";
        for (Object value : db.jsonList(calendar.get("dates"))) {
            if (!(value instanceof Map<?, ?> rawDate)) {
                continue;
            }
            Map<String, Object> date = new LinkedHashMap<>();
            rawDate.forEach((key, rawValue) -> date.put(String.valueOf(key), rawValue));
            int available = db.intValue(date.get("available"), 0);
            if (available <= 0) {
                continue;
            }
            slotCount += available;
            if (blank(nextAvailableText)) {
                String month = db.string(calendar.get("month"));
                String day = db.string(date.get("day"));
                nextAvailableText = blank(month) ? "最近可约 " + day : "最近可约 " + month + day + "日";
            }
        }
        item.put("available_slot_count", slotCount);
        item.put("next_available_text", slotCount > 0 ? nextAvailableText + "，剩余 " + slotCount + " 个时段" : "暂无可约时段");
    }

    public ResponseEntity<Map<String, Object>> getPsychologyResources() {
        List<Map<String, Object>> videos = db.list("""
            SELECT *
            FROM psychology_videos
            WHERE is_active = 1
            ORDER BY sort_order ASC, id ASC
            """);
        videos.forEach(this::normalizePsychologyVideo);

        List<Map<String, Object>> categories = db.list("""
            SELECT id, name, icon, class_name, sort_order
            FROM psychology_categories
            WHERE is_active = 1
            ORDER BY sort_order ASC, id ASC
            """);

        List<Map<String, Object>> questions = db.list("""
            SELECT q.id, q.question, q.sort_order, COUNT(r.id) AS reply_count
            FROM psychology_questions q
            LEFT JOIN psychology_question_replies r ON r.question_id = q.id AND r.is_active = 1
            WHERE q.is_active = 1
            GROUP BY q.id, q.question, q.sort_order
            ORDER BY q.sort_order ASC, q.id ASC
            """);

        return ok(db.map(
            "videos", videos,
            "categories", categories,
            "questions", questions
        ));
    }

    public ResponseEntity<Map<String, Object>> createAdminPsychologyVideo(Map<String, Object> data) {
        if (data == null) {
            return bad("missing required fields");
        }
        String slug = db.string(value(data, "slug", "")).trim();
        String title = db.string(value(data, "title", "")).trim();
        String sourceUrl = db.string(value(data, "source_url", "")).trim();
        if (blank(slug) || blank(title) || blank(sourceUrl)) {
            return bad("psychology video requires slug, title and source_url");
        }

        long id = db.insert("""
            INSERT INTO psychology_videos (
                slug, title, category, duration, speaker, summary, poster_url, source_url, license,
                cover_class_name, takeaways, sort_order, is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            slug,
            title,
            db.string(value(data, "category", "")).trim(),
            db.string(value(data, "duration", "")).trim(),
            db.string(value(data, "speaker", "")).trim(),
            db.string(value(data, "summary", "")).trim(),
            db.string(value(data, "poster_url", "")).trim(),
            sourceUrl,
            db.string(value(data, "license", "")).trim(),
            db.string(value(data, "cover_class_name", "")).trim(),
            db.toJson(psychologyTakeaways(value(data, "takeaways", List.of()))),
            db.intValue(value(data, "sort_order", 0), 0),
            activeFlag(value(data, "is_active", 1), 1)
        );
        return created(db.map("success", true, "video_id", id));
    }

    public ResponseEntity<Map<String, Object>> updateAdminPsychologyVideo(long videoId, Map<String, Object> data) {
        if (videoId <= 0) {
            return bad("invalid video id");
        }
        if (data == null || data.isEmpty()) {
            return bad("no fields to update");
        }
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        ResponseEntity<Map<String, Object>> invalid = collectPsychologyVideoUpdates(data, sets, args);
        if (invalid != null) {
            return invalid;
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(videoId);
        int updated = db.update("UPDATE psychology_videos SET " + String.join(", ", sets) + " WHERE id = ?", args.toArray());
        if (updated == 0) {
            return notFound("video not found");
        }
        return ok(db.map("success", true, "video_id", videoId));
    }

    public ResponseEntity<Map<String, Object>> createAdminPsychologyQuestion(Map<String, Object> data) {
        if (data == null) {
            return bad("missing required fields");
        }
        String question = db.string(value(data, "question", "")).trim();
        if (blank(question)) {
            return bad("question is required");
        }
        long id = db.insert("""
            INSERT INTO psychology_questions (question, sort_order, is_active)
            VALUES (?, ?, ?)
            """,
            question,
            db.intValue(value(data, "sort_order", 0), 0),
            activeFlag(value(data, "is_active", 1), 1)
        );
        return created(db.map("success", true, "question_id", id));
    }

    public ResponseEntity<Map<String, Object>> updateAdminPsychologyQuestion(long questionId, Map<String, Object> data) {
        if (questionId <= 0) {
            return bad("invalid question id");
        }
        if (data == null || data.isEmpty()) {
            return bad("no fields to update");
        }
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (data.containsKey("question")) {
            String question = db.string(data.get("question")).trim();
            if (blank(question)) {
                return bad("question cannot be blank");
            }
            sets.add("question = ?");
            args.add(question);
        }
        if (data.containsKey("sort_order")) {
            sets.add("sort_order = ?");
            args.add(db.intValue(data.get("sort_order"), 0));
        }
        if (data.containsKey("is_active")) {
            sets.add("is_active = ?");
            args.add(activeFlag(data.get("is_active"), 1));
        }
        if (sets.isEmpty()) {
            return bad("no fields to update");
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        args.add(questionId);
        int updated = db.update("UPDATE psychology_questions SET " + String.join(", ", sets) + " WHERE id = ?", args.toArray());
        if (updated == 0) {
            return notFound("question not found");
        }
        return ok(db.map("success", true, "question_id", questionId));
    }

    public ResponseEntity<Map<String, Object>> getPsychologyQuestion(long questionId) {
        Map<String, Object> question = db.one("""
            SELECT q.id, q.question, q.sort_order, COUNT(r.id) AS reply_count
            FROM psychology_questions q
            LEFT JOIN psychology_question_replies r ON r.question_id = q.id AND r.is_active = 1
            WHERE q.id = ? AND q.is_active = 1
            GROUP BY q.id, q.question, q.sort_order
            LIMIT 1
            """, questionId).orElse(null);
        if (question == null) {
            return notFound("question not found");
        }

        List<Map<String, Object>> replies = db.list("""
            SELECT id, question_id, reply_type, author_name, author_role, content, like_count, sort_order, created_at
            FROM psychology_question_replies
            WHERE question_id = ? AND is_active = 1
            ORDER BY sort_order ASC, id ASC
            """, questionId);

        return ok(db.map("question", question, "replies", replies));
    }

    public String psychologyVideoSource(String slug) {
        if (blank(slug)) {
            return "";
        }
        return db.string(db.one("""
            SELECT source_url
            FROM psychology_videos
            WHERE slug = ? AND is_active = 1
            LIMIT 1
            """, slug).map(row -> row.get("source_url")).orElse(""));
    }

    private void normalizePsychologyVideo(Map<String, Object> item) {
        item.put("takeaways", db.jsonList(item.get("takeaways")).stream().map(String::valueOf).toList());
    }

    private ResponseEntity<Map<String, Object>> collectPsychologyVideoUpdates(Map<String, Object> data,
                                                                              List<String> sets,
                                                                              List<Object> args) {
        for (String field : List.of("slug", "title", "source_url")) {
            if (!data.containsKey(field)) {
                continue;
            }
            String text = db.string(data.get(field)).trim();
            if (blank(text)) {
                return bad(field + " cannot be blank");
            }
            sets.add(field + " = ?");
            args.add(text);
        }
        for (String field : List.of("category", "duration", "speaker", "summary", "poster_url", "license", "cover_class_name")) {
            if (data.containsKey(field)) {
                sets.add(field + " = ?");
                args.add(db.string(data.get(field)).trim());
            }
        }
        if (data.containsKey("takeaways")) {
            sets.add("takeaways = ?");
            args.add(db.toJson(psychologyTakeaways(data.get("takeaways"))));
        }
        if (data.containsKey("sort_order")) {
            sets.add("sort_order = ?");
            args.add(db.intValue(data.get("sort_order"), 0));
        }
        if (data.containsKey("is_active")) {
            sets.add("is_active = ?");
            args.add(activeFlag(data.get("is_active"), 1));
        }
        return null;
    }

    private List<String> psychologyTakeaways(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                .map(String::valueOf)
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
        }
        String text = db.string(value).trim();
        if (blank(text)) {
            return List.of();
        }
        return Arrays.stream(text.split("[\\r\\n,，;；]+"))
            .map(String::trim)
            .filter(item -> !item.isBlank())
            .toList();
    }

    private int activeFlag(Object value, int fallback) {
        if (value == null) {
            return fallback;
        }
        String text = db.string(value).trim();
        if ("0".equals(text) || "false".equalsIgnoreCase(text) || "no".equalsIgnoreCase(text)) {
            return 0;
        }
        return 1;
    }

    public ResponseEntity<Map<String, Object>> getConsultations(Map<String, String> params) {
        String familyId = params.get("family_id");
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        QueryParts query = new QueryParts("c.family_id = ?", familyId);
        addEquals(query, "c.elderly_id", params.get("elderly_id"));
        addEquals(query, "c.status", params.get("status"));
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
        consultations.forEach(this::attachConsultationFamilySummary);
        return ok("consultations", consultations);
    }
    public ResponseEntity<Map<String, Object>> createConsultation(Map<String, Object> data) {
        if (!has(data, "family_id", "scheduled_time")) {
            return bad("missing required fields");
        }
        String familyId = db.string(data.get("family_id"));
        Object elderlyId = value(data, "elderly_id", null);
        Object counselorId = value(data, "counselor_id", null);
        String consultationType = db.string(value(data, "consultation_type", "phone"));
        String note = db.string(value(data, "note", ""));
        String status = db.string(value(data, "status", "scheduled"));
        ResponseEntity<Map<String, Object>> bookingCheck = validateCounselorBooking(counselorId, data.get("scheduled_time"));
        if (bookingCheck != null) {
            return bookingCheck;
        }
        long id = db.insert("""
            INSERT INTO consultations (family_id, elderly_id, counselor_id, consultation_type, scheduled_time, duration, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, familyId, elderlyId, counselorId, consultationType, data.get("scheduled_time"), value(data, "duration", 45),
            status, note);

        auditCareAction(familyId, elderlyId, "elderly", "elderly", "consultation_created",
            blank(note) ? "老人端创建心理咨询预约" : note, db.map("consultation_id", id, "payload", data));

        Long alertId = null;
        if (db.boolValue(value(data, "notify_service", false))) {
            String concernLevel = normalizePriority(db.string(value(data, "concern_level", "medium")));
            String topic = db.string(value(data, "topic", "心理咨询协同")).trim();
            String title = "心理咨询协同";
            String message = blank(topic)
                ? "老人端创建了心理咨询预约，请服务人员跟进。"
                : "老人端提交心理咨询需求：" + topic + "。请服务人员确认预约并持续跟进。";
            Map<String, Object> alertData = db.map(
                "family_id", familyId,
                "elderly_id", elderlyId,
                "alert_type", "psychological_support",
                "level", concernLevel,
                "title", title,
                "message", message,
                "metadata", db.map(
                    "consultation_id", id,
                    "consultation_type", consultationType,
                    "scheduled_time", data.get("scheduled_time"),
                    "topic", topic
                )
            );
            alertId = insertAlert(alertData, "elderly");
            auditCareAction(familyId, elderlyId, "elderly", "elderly", "psychological_support_requested",
                message, db.map("consultation_id", id, "alert_id", alertId, "payload", data));
        }

        return created(db.map("success", true, "consultation_id", id, "alert_id", alertId));
    }

    private ResponseEntity<Map<String, Object>> validateCounselorBooking(Object counselorIdValue, Object scheduledTimeValue) {
        long counselorId = db.longValue(counselorIdValue, 0);
        if (counselorId <= 0) {
            return null;
        }
        Map<String, Object> counselor = db.one("""
            SELECT id, name, available, is_active
            FROM counselors
            WHERE id = ?
            LIMIT 1
            """, counselorId).orElse(null);
        if (counselor == null || !db.boolValue(value(counselor, "is_active", 1))) {
            return bad("counselor not found");
        }
        if (!db.boolValue(counselor.get("available"))) {
            return bad("counselor is not available");
        }
        String scheduledTime = db.string(scheduledTimeValue).trim();
        long overlapping = db.count("""
            SELECT COUNT(*)
            FROM consultations
            WHERE counselor_id = ?
              AND scheduled_time = ?
              AND status IN ('scheduled', 'in_progress')
            """, counselorId, scheduledTime);
        if (overlapping > 0) {
            return bad("counselor slot is already booked");
        }
        return null;
    }
    public ResponseEntity<Map<String, Object>> updateConsultation(long consultationId, Map<String, Object> data) {
        Map<String, Object> body = data == null ? Map.of() : data;
        String familyId = db.string(body.get("family_id"));
        if (blank(familyId)) {
            return bad("missing family_id");
        }
        Map<String, Object> current = db.one("""
            SELECT id, family_id, elderly_id, status, scheduled_time, note
            FROM consultations
            WHERE id = ? AND family_id = ?
            LIMIT 1
            """, consultationId, familyId).orElse(null);
        if (current == null) {
            return notFound("consultation not found");
        }
        ResponseEntity<Map<String, Object>> lifecycleCheck = validateConsultationLifecycle(current, body);
        if (lifecycleCheck != null) {
            return lifecycleCheck;
        }
        ResponseEntity<Map<String, Object>> response = familyScopedUpdate(
            "consultations",
            consultationId,
            familyId,
            body,
            List.of("consultation_type", "scheduled_time", "duration", "status", "note", "counselor_id"),
            "consultation",
            false
        );
        if (response.getStatusCode().is2xxSuccessful()) {
            Map<String, Object> row = db.one("SELECT family_id, elderly_id, note FROM consultations WHERE id = ? LIMIT 1", consultationId).orElse(current);
            auditCareAction(db.string(row.get("family_id")), row.get("elderly_id"), "elderly", "elderly",
                "consultation_updated", db.string(value(row, "note", "心理咨询预约已更新")),
                db.map("consultation_id", consultationId, "payload", body));
        }
        return response;
    }

    private ResponseEntity<Map<String, Object>> validateConsultationLifecycle(Map<String, Object> current,
                                                                              Map<String, Object> data) {
        String currentStatus = normalizeConsultationStatus(db.string(current.get("status")));
        String nextStatus = normalizeConsultationStatus(db.string(value(data, "status", currentStatus)));
        if (!List.of("scheduled", "in_progress", "completed", "cancelled").contains(nextStatus)) {
            return bad("unsupported consultation status");
        }
        boolean rescheduling = data.containsKey("scheduled_time")
            && !db.string(data.get("scheduled_time")).equals(db.string(current.get("scheduled_time")));
        boolean terminal = "completed".equals(currentStatus) || "cancelled".equals(currentStatus);
        if (terminal && (!nextStatus.equals(currentStatus) || rescheduling)) {
            return bad("completed or cancelled consultations cannot be changed");
        }
        if (rescheduling && !"scheduled".equals(currentStatus)) {
            return bad("only scheduled consultations can be rescheduled");
        }
        if ("cancelled".equals(nextStatus) && "completed".equals(currentStatus)) {
            return bad("completed consultations cannot be cancelled");
        }
        if ("cancelled".equals(nextStatus)) {
            String reason = db.string(value(data, "note", data.get("cancel_reason"))).trim();
            if (blank(reason)) {
                return bad("cancellation reason is required");
            }
        }
        return null;
    }

    private void attachConsultationFamilySummary(Map<String, Object> consultation) {
        String status = normalizeConsultationStatus(db.string(consultation.get("status")));
        String counselorName = db.string(consultation.get("counselor_name"));
        String type = consultationTypeLabel(db.string(consultation.get("consultation_type")));
        String scheduledAt = db.string(consultation.get("scheduled_time"));
        String note = db.string(consultation.get("note"));
        String owner = blank(counselorName) ? "咨询师" : counselorName;
        String statusLabel = consultationStatusLabel(status);
        consultation.put("status_label", statusLabel);
        consultation.put("can_reschedule", "scheduled".equals(status));
        consultation.put("can_cancel", "scheduled".equals(status) || "in_progress".equals(status));
        consultation.put("family_visible_summary", "%s %s %s，当前状态：%s%s".formatted(
            blank(scheduledAt) ? "待确认时间" : scheduledAt,
            owner,
            type,
            statusLabel,
            blank(note) ? "" : "，备注：" + note
        ));
        consultation.put("next_action", consultationNextAction(status));
    }

    private String normalizeConsultationStatus(String status) {
        String normalized = status == null ? "" : status.trim().toLowerCase(Locale.ROOT);
        return blank(normalized) ? "scheduled" : normalized;
    }

    private String consultationStatusLabel(String status) {
        return switch (normalizeConsultationStatus(status)) {
            case "in_progress" -> "进行中";
            case "completed" -> "已完成";
            case "cancelled" -> "已取消";
            default -> "已预约";
        };
    }

    private String consultationTypeLabel(String type) {
        return switch (db.string(type)) {
            case "video" -> "视频咨询";
            case "text" -> "文字咨询";
            default -> "电话咨询";
        };
    }

    private String consultationNextAction(String status) {
        return switch (normalizeConsultationStatus(status)) {
            case "in_progress" -> "服务人员应补充咨询记录，完成后回流给家属。";
            case "completed" -> "家属可查看本次咨询摘要，必要时预约下一次跟进。";
            case "cancelled" -> "如仍需支持，请重新预约或联系服务人员。";
            default -> "如需改约或取消，请在咨询开始前处理并说明原因。";
        };
    }
    public ResponseEntity<Map<String, Object>> uploadMedia(MultipartFile file,
                                                           String family_id,
                                                           String title,
                                                           String description,
                                                           Long uploaded_by) {
        try {
            UploadSecurityValidator.Result validation = UploadSecurityValidator.validate(file, UploadSecurityValidator.Profile.FAMILY_MEDIA);
            if (!validation.accepted()) {
                return bad(validation.message());
            }
            Files.createDirectories(properties.uploadDir);
            Files.createDirectories(properties.uploadDir.resolve("thumbnails"));
            String ext = validation.extension();
            String filename = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSSSSS").format(LocalDateTime.now(properties.zoneId))
                + "-" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            Path uploadRoot = properties.uploadDir.toAbsolutePath().normalize();
            Path target = uploadRoot.resolve(filename).toAbsolutePath().normalize();
            if (!target.startsWith(uploadRoot)) {
                return status(HttpStatus.FORBIDDEN, db.map("error", "media path is outside upload directory"));
            }
            file.transferTo(target);
            String mediaType = List.of("mp4", "mov", "avi").contains(ext) ? "video" : "photo";
            Path thumbnail = "video".equals(mediaType) ? generateVideoThumbnail(target, filename) : generatePhotoThumbnail(target, filename);
            long id = db.insert("""
                INSERT INTO media (family_id, media_type, title, description, file_path, file_size, thumbnail_path, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, family_id, mediaType, title, description, target.toString(), Files.size(target), thumbnail == null ? null : thumbnail.toString(), uploaded_by);
            db.insert("INSERT INTO media_policies (media_id, time_windows, moods, occasions, cooldown, priority) VALUES (?, ?, ?, ?, ?, ?)", id, "[]", "[]", "[]", 60, 5);
            String fileUrl = mediaAssetUrl(id, family_id, false);
            return created(db.map("success", true, "media_id", id, "file_path", fileUrl, "file_url", fileUrl, "media_type", mediaType));
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

    public ResponseEntity<?> downloadMediaAsset(long mediaId, String familyId, boolean thumbnail) {
        if (blank(familyId)) {
            return bad("missing family_id");
        }

        Map<String, Object> media = db.one("""
            SELECT id, family_id, media_type, title, file_path, thumbnail_path
            FROM media
            WHERE id = ? AND family_id = ? AND is_active = 1
            """, mediaId, familyId).orElse(null);
        if (media == null) {
            return notFound("media not found");
        }

        String storedPath = db.string(media.get(thumbnail ? "thumbnail_path" : "file_path"));
        if (blank(storedPath)) {
            return notFound(thumbnail ? "thumbnail not found" : "media file not found");
        }

        Path path;
        try {
            path = resolveStoredMediaPath(storedPath);
        } catch (IllegalArgumentException error) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "media path is outside upload directory"));
        }
        if (!Files.isRegularFile(path)) {
            return notFound(thumbnail ? "thumbnail not found" : "media file not found");
        }

        MediaType contentType = probeMediaType(path);
        return ResponseEntity.ok()
            .contentType(contentType)
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeDownloadName(path) + "\"")
            .body(new FileSystemResource(path));
    }

    public ResponseEntity<?> downloadAiAudio(String filename, String token) {
        Map<String, Object> claims = SessionTokenCodec.verifySignedPayload(token, properties, mapper);
        if (claims == null
            || !"ai_audio".equals(db.string(claims.get("purpose")))
            || !filename.equals(db.string(claims.get("file")))) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "invalid or expired audio token"));
        }

        if (filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "invalid audio file"));
        }

        Path audioRoot = properties.aiAudioDir.toAbsolutePath().normalize();
        Path path = audioRoot.resolve(filename).toAbsolutePath().normalize();
        if (!path.startsWith(audioRoot)) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "audio path is outside audio directory"));
        }
        if (!Files.isRegularFile(path)) {
            return notFound("audio file not found");
        }

        return ResponseEntity.ok()
            .contentType(probeMediaType(path))
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=" + Math.max(60, properties.aiAudioUrlTtlSeconds))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeDownloadName(path) + "\"")
            .body(new FileSystemResource(path));
    }

    public ResponseEntity<?> downloadAiVoiceUpload(String filename, String token) {
        Map<String, Object> claims = SessionTokenCodec.verifySignedPayload(token, properties, mapper);
        if (claims == null
            || !"ai_voice_upload".equals(db.string(claims.get("purpose")))
            || !filename.equals(db.string(claims.get("file")))) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "invalid or expired voice upload token"));
        }

        if (filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "invalid voice file"));
        }
        String ext = extension(filename);
        if (!List.of("mp3", "aac", "m4a", "wav", "webm", "ogg", "flac").contains(ext)) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "unsupported voice file"));
        }

        Path voiceRoot = properties.aiVoiceUploadDir.toAbsolutePath().normalize();
        Path path = voiceRoot.resolve(filename).toAbsolutePath().normalize();
        if (!path.startsWith(voiceRoot)) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "voice path is outside upload directory"));
        }
        if (!Files.isRegularFile(path)) {
            return notFound("voice file not found");
        }

        return ResponseEntity.ok()
            .contentType(probeMediaType(path))
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=" + Math.max(60, properties.aiVoiceUploadUrlTtlSeconds))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeDownloadName(path) + "\"")
            .body(new FileSystemResource(path));
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
        List<Map<String, Object>> history = db.list("""
            SELECT mph.*, m.family_id, m.title, m.media_type, m.file_path, m.thumbnail_path, mf.feedback_type
            FROM media_play_history mph
            INNER JOIN media m ON mph.media_id = m.id
            LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
            WHERE mph.elderly_id = ?
            ORDER BY mph.played_at DESC
            LIMIT ?
            """, elderly_id, limit);
        history.forEach(this::attachMediaAssetUrls);
        return ok("history", history);
    }
    public ResponseEntity<Map<String, Object>> getRecentPlays(String family_id,
                                                              int limit) {
        if (blank(family_id)) {
            return bad("missing family_id");
        }
        List<Map<String, Object>> recentPlays = db.list("""
            SELECT m.id, m.family_id, m.title, m.media_type, m.thumbnail_path, mph.played_at,
                   COUNT(CASE WHEN mf.feedback_type = 'like' THEN 1 END) AS likes,
                   COUNT(CASE WHEN mf.feedback_type = 'dislike' THEN 1 END) AS dislikes
            FROM media m
            INNER JOIN media_play_history mph ON m.id = mph.media_id
            LEFT JOIN media_feedback mf ON m.id = mf.media_id
            WHERE m.family_id = ?
            GROUP BY m.id, m.family_id, m.title, m.media_type, m.thumbnail_path, mph.played_at
            ORDER BY mph.played_at DESC
            LIMIT ?
            """, family_id, limit);
        recentPlays.forEach(this::attachMediaAssetUrls);
        return ok("recent_plays", recentPlays);
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
        Map<String, Object> body = data == null ? Map.of() : data;
        String message = db.string(value(body, "message", value(body, "text", "")));
        String user = db.string(value(body, "user", "User"));
        String familyId = db.string(body.get("family_id"));
        Object elderlyId = normalizedElderlyId(body.get("elderly_id"));
        if (hasAiCrisisSignal(message)) {
            return ok(aiCrisisResponse(message, familyId, elderlyId));
        }
        try {
            return ok(aiCompanion.chat(message, user, origin(headers)));
        } catch (IllegalArgumentException ex) {
            return bad(ex.getMessage());
        } catch (Exception ex) {
            return ok(aiCompanion.fallbackChat(message, user, ex.getMessage()));
        }
    }
    public ResponseEntity<Map<String, Object>> aiVoiceChat(MultipartFile file,
                                                           MultipartFile voice,
                                                           MultipartFile audio,
                                                           String user,
                                                           String familyId,
                                                           Object elderlyId,
                                                           HttpHeaders headers) {
        try {
            Map<String, Object> result = aiCompanion.voiceChat(file != null ? file : (voice != null ? voice : audio), user, origin(headers));
            if (result.containsKey("error")) {
                return status(HttpStatus.UNPROCESSABLE_ENTITY, result);
            }
            if (hasAiCrisisSignal(db.string(result.get("transcript")))) {
                Map<String, Object> crisis = aiCrisisResponse(db.string(result.get("transcript")), familyId, normalizedElderlyId(elderlyId));
                crisis.put("transcript", result.get("transcript"));
                crisis.put("asr_provider", result.get("asr_provider"));
                crisis.put("asr_error", result.get("asr_error"));
                return ok(crisis);
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
        List<Map<String, Object>> checks = new ArrayList<>();
        checks.add(databaseHealthCheck());
        checks.add(directoryHealthCheck("upload_dir", properties.uploadDir, true));
        checks.add(directoryHealthCheck("ai_audio_dir", properties.aiAudioDir, false));
        checks.add(directoryHealthCheck("ai_voice_upload_dir", properties.aiVoiceUploadDir, false));
        checks.add(configHealthCheck());

        String status = checks.stream().anyMatch(check -> "critical".equals(check.get("level")))
            ? "down"
            : checks.stream().anyMatch(check -> "warning".equals(check.get("level"))) ? "degraded" : "ok";
        Map<String, Object> components = new LinkedHashMap<>();
        for (Map<String, Object> check : checks) {
            components.put(db.string(check.get("name")), check);
        }
        return ok(db.map(
            "status", status,
            "timestamp", LocalDateTime.now(properties.zoneId).format(DATE_TIME),
            "backend", "java-spring-boot",
            "components", components,
            "checks", checks
        ));
    }

    public ResponseEntity<Map<String, Object>> getAdminOpsMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("open_alerts", safeMetricCount("open_alerts", "SELECT COUNT(*) FROM family_alerts WHERE handled = 0"));
        metrics.put("unread_alerts", safeMetricCount("unread_alerts", "SELECT COUNT(*) FROM family_alerts WHERE read = 0"));
        metrics.put("pending_privacy_requests", safeMetricCount("pending_privacy_requests", "SELECT COUNT(*) FROM privacy_requests WHERE status = 'pending'"));
        metrics.put("pending_service_certifications", safeMetricCount("pending_service_certifications", "SELECT COUNT(*) FROM service_certifications WHERE status = 'pending'"));
        metrics.put("active_auth_accounts", safeMetricCount("active_auth_accounts", "SELECT COUNT(*) FROM auth_accounts WHERE disabled = 0"));
        metrics.put("locked_auth_accounts", safeMetricCount("locked_auth_accounts", "SELECT COUNT(*) FROM auth_accounts WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP"));
        boolean degraded = metrics.values().stream()
            .filter(Map.class::isInstance)
            .map(Map.class::cast)
            .anyMatch(metric -> "critical".equals(metric.get("level")));
        return ok(db.map(
            "generated_at", LocalDateTime.now(properties.zoneId).format(DATE_TIME),
            "status", degraded ? "degraded" : "ok",
            "metrics", metrics
        ));
    }

    private Map<String, Object> safeMetricCount(String name, String sql) {
        try {
            return db.map("name", name, "value", db.count(sql), "level", "ok");
        } catch (Exception error) {
            return db.map("name", name, "value", -1L, "level", "critical", "message", error.getMessage());
        }
    }

    public ResponseEntity<Map<String, Object>> retentionSummary() {
        return ok(db.map(
            "generated_at", LocalDateTime.now(properties.zoneId).format(DATE_TIME),
            "policy", db.map(
                "ai_audio_retention_count", properties.aiAudioRetentionCount,
                "ai_audio_url_ttl_seconds", properties.aiAudioUrlTtlSeconds,
                "ai_voice_retention_days", properties.aiVoiceRetentionDays,
                "mental_frame_retention_days", properties.mentalFrameRetentionDays,
                "ai_chat_retention_days", properties.aiChatRetentionDays,
                "consultation_retention_days", properties.consultationRetentionDays,
                "audit_log_retention_days", properties.auditLogRetentionDays
            ),
            "storage", db.map(
                "upload_dir", retentionDirectoryStatus(properties.uploadDir),
                "ai_audio_dir", retentionDirectoryStatus(properties.aiAudioDir),
                "ai_voice_upload_dir", retentionDirectoryStatus(properties.aiVoiceUploadDir)
            )
        ));
    }

    private Map<String, Object> databaseHealthCheck() {
        try {
            db.count("SELECT 1");
            return healthComponent("database", "ok", "database query succeeded", true);
        } catch (Exception error) {
            return healthComponent("database", "critical", "database query failed: " + error.getMessage(), false);
        }
    }

    private Map<String, Object> directoryHealthCheck(String name, Path dir, boolean required) {
        boolean exists = dir != null && Files.isDirectory(dir);
        boolean writable = exists && Files.isWritable(dir);
        String level = exists && writable ? "ok" : required ? "critical" : "warning";
        String message;
        if (dir == null) {
            message = "directory is not configured";
        } else if (!exists) {
            message = "directory does not exist";
        } else if (!writable) {
            message = "directory is not writable";
        } else {
            message = "directory is writable";
        }
        Map<String, Object> component = healthComponent(name, level, message, exists && writable);
        component.put("path", dir == null ? "" : dir.toString());
        component.put("required", required);
        return component;
    }

    private Map<String, Object> configHealthCheck() {
        List<String> warnings = new ArrayList<>();
        if (!properties.apiTokenEnabled) {
            warnings.add("api token protection is disabled");
        }
        if (!properties.familyScopeSessionRequired) {
            warnings.add("family scope session requirement is disabled");
        }
        if (properties.phoneSuffixLoginEnabled) {
            warnings.add("phone suffix login compatibility is enabled");
        }
        return healthComponent(
            "security_config",
            warnings.isEmpty() ? "ok" : "warning",
            warnings.isEmpty() ? "security toggles are hardened" : String.join("; ", warnings),
            warnings.isEmpty()
        );
    }

    private Map<String, Object> healthComponent(String name, String level, String message, boolean healthy) {
        return db.map(
            "name", name,
            "level", level,
            "healthy", healthy,
            "message", message
        );
    }

    private Map<String, Object> retentionDirectoryStatus(Path dir) {
        boolean exists = dir != null && Files.isDirectory(dir);
        long fileCount = 0;
        if (exists) {
            try (var stream = Files.list(dir)) {
                fileCount = stream.filter(Files::isRegularFile).count();
            } catch (IOException ignored) {
                fileCount = -1;
            }
        }
        return db.map(
            "path", dir == null ? "" : dir.toString(),
            "exists", exists,
            "file_count", fileCount
        );
    }

    private long insertAlert(Map<String, Object> data, String source) {
        return db.insert("""
            INSERT INTO family_alerts (family_id, elderly_id, alert_type, level, title, message, metadata, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, data.get("family_id"), data.get("elderly_id"), data.get("alert_type"), data.get("level"),
            data.get("title"), data.get("message"), db.toJson(value(data, "metadata", Map.of())), source);
    }

    private Map<String, Object> aiCrisisResponse(String message,
                                                 String familyId,
                                                 Object elderlyId) {
        Long alertId = null;
        String nextStep;
        if (!blank(familyId)) {
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("family_id", familyId);
            alert.put("elderly_id", elderlyId);
            alert.put("alert_type", "ai_crisis");
            alert.put("level", "high");
            alert.put("title", "AI crisis alert");
            alert.put("message", "AI companion detected possible self-harm or crisis language. Family and service staff should follow up immediately.");
            alert.put("metadata", db.map(
                "trigger", "ai_chat",
                "message", message == null ? "" : message.trim()
            ));
            alertId = insertAlert(alert, "ai_companion");
            auditCareAction(familyId, elderlyId, "ai", "AI companion", "ai_crisis_detected",
                "AI companion detected a high-risk expression and escalated it for human follow-up.", db.map("alert_id", alertId));
            nextStep = "A high-risk alert has been created. Family and service staff should follow up immediately.";
        } else {
            nextStep = "Family information is missing, so an alert could not be created automatically. Contact a trusted person or local emergency support immediately.";
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", message == null ? "" : message.trim());
        response.put("reply", "I hear that this feels very hard right now. Please do not stay alone. Contact family, service staff, or another trusted person immediately; if you may hurt yourself, call local emergency services now.");
        response.put("chat_provider", "safety");
        response.put("provider_error", "");
        response.put("audio_url", "");
        response.put("audio_error", "High-risk conversation escalated for human follow-up; voice synthesis is skipped.");
        response.put("tts_provider", "safety");
        response.put("crisis_detected", true);
        response.put("alert_id", alertId);
        response.put("next_step", nextStep);
        return response;
    }

    private Object normalizedElderlyId(Object value) {
        long id = db.longValue(value, 0);
        return id > 0 ? id : null;
    }

    private boolean consentAccepted(Object value) {
        String text = db.string(value);
        return !("false".equalsIgnoreCase(text) || "0".equals(text) || "no".equalsIgnoreCase(text));
    }

    private boolean hasAiCrisisSignal(String message) {
        String text = message == null ? "" : message.trim();
        if (text.isBlank()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        return lower.contains("轻生")
            || lower.contains("自杀")
            || lower.contains("不想")
            || lower.contains("活不下去")
            || lower.contains("结束生命")
            || lower.contains("伤害自己")
            || lower.contains("自残")
            || lower.contains("割腕")
            || lower.contains("跳楼")
            || lower.contains("suicide")
            || lower.contains("kill myself")
            || lower.contains("want to die")
            || lower.contains("end my life");
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
        attachMediaAssetUrls(row);
    }

    private void attachMediaAssetUrls(Map<String, Object> row) {
        long mediaId = db.longValue(value(row, "media_id", row.get("id")), 0);
        String familyId = db.string(row.get("family_id"));
        if (mediaId <= 0 || blank(familyId)) {
            return;
        }

        if (!blank(db.string(row.get("file_path")))) {
            String fileUrl = mediaAssetUrl(mediaId, familyId, false);
            row.put("file_path", fileUrl);
            row.put("file_url", fileUrl);
        }
        if (!blank(db.string(row.get("thumbnail_path")))) {
            String thumbnailUrl = mediaAssetUrl(mediaId, familyId, true);
            row.put("thumbnail_path", thumbnailUrl);
            row.put("thumbnail_url", thumbnailUrl);
        }
    }

    private String mediaAssetUrl(long mediaId, String familyId, boolean thumbnail) {
        String suffix = thumbnail ? "/thumbnail" : "/file";
        return "/api/family/media/" + mediaId + suffix + "?family_id=" + URLEncoder.encode(familyId, StandardCharsets.UTF_8);
    }

    private Path resolveStoredMediaPath(String storedPath) {
        String normalizedPath = storedPath.replace('\\', '/');
        Path candidate;
        if (normalizedPath.startsWith("/uploads/")) {
            candidate = properties.uploadDir.resolve(normalizedPath.substring("/uploads/".length()));
        } else if (normalizedPath.startsWith("uploads/")) {
            candidate = properties.uploadDir.resolve(normalizedPath.substring("uploads/".length()));
        } else {
            Path raw = Path.of(storedPath);
            candidate = raw.isAbsolute() ? raw : properties.projectRoot.resolve(raw);
        }

        Path uploadRoot = properties.uploadDir.toAbsolutePath().normalize();
        Path resolved = candidate.toAbsolutePath().normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("outside upload directory");
        }
        return resolved;
    }

    private MediaType probeMediaType(Path path) {
        try {
            String type = Files.probeContentType(path);
            if (!blank(type)) {
                return MediaType.parseMediaType(type);
            }
        } catch (Exception ignored) {
            // Fall back to an opaque binary response when the platform cannot detect the type.
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    private String safeDownloadName(Path path) {
        return path.getFileName().toString().replace("\"", "");
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
            case "psychological_support" -> "心理咨询协同";
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

    private String careStatusLabel(String riskLevel) {
        return switch (riskLevel) {
            case "high" -> "需要优先跟进";
            case "medium" -> "建议持续关注";
            default -> "今日状态平稳";
        };
    }

    private String careRiskReason(String riskLevel,
                                  Map<String, Object> latestOpenAlert,
                                  Map<String, Object> latestMood,
                                  long highAlertCount,
                                  long openAlertCount,
                                  int todayTasks,
                                  int completionRate,
                                  long pendingMessages) {
        if (latestOpenAlert != null) {
            String title = db.string(value(latestOpenAlert, "title", ""));
            String label = blank(title) ? serviceAlertTypeLabel(db.string(latestOpenAlert.get("alert_type"))) : title;
            String message = db.string(latestOpenAlert.get("message"));
            if (highAlertCount > 0) {
                return "存在 " + highAlertCount + " 条高优先级预警未处理，最近一条是「" + label + "」：" + message;
            }
            return "存在 " + openAlertCount + " 条待处理预警，最近一条是「" + label + "」：" + message;
        }

        int moodScore = latestMood == null ? 0 : db.intValue(latestMood.get("mood_score"), 0);
        if (moodScore > 0 && moodScore <= 4) {
            return "最近一次情绪评分为 " + moodScore + " 分，低于安全观察阈值，需要主动问候。";
        }
        if ("medium".equals(riskLevel) && moodScore > 0 && moodScore <= 6) {
            return "最近一次情绪评分为 " + moodScore + " 分，建议持续观察情绪变化。";
        }
        if (todayTasks > 0 && completionRate < 60) {
            return "今日照护任务完成率为 " + completionRate + "%，建议确认是否漏服、漏餐或未完成活动。";
        }
        if (pendingMessages > 0) {
            return "还有 " + pendingMessages + " 条家属留言未播放，可优先提醒老人收听。";
        }
        return "今日暂无未处理预警，任务与互动没有明显异常。";
    }

    private String careNextStep(String riskLevel,
                                long openAlertCount,
                                int todayTasks,
                                int completionRate,
                                long pendingMessages,
                                long activeFollowups) {
        if ("high".equals(riskLevel)) {
            return "服务人员先确认安全与位置，必要时联系家属；处理完成后补充服务记录。";
        }
        if (openAlertCount > 0) {
            return "进入工单详情核实预警原因，10 分钟内给出处理结果或随访安排。";
        }
        if (activeFollowups > 0) {
            return "按计划完成随访，并把结论回流给家属端。";
        }
        if (todayTasks > 0 && completionRate < 80) {
            return "提醒老人完成剩余照护任务，家属端可查看完成率变化。";
        }
        if (pendingMessages > 0) {
            return "提醒老人播放家属留言，增强亲情陪伴感。";
        }
        return "保持例行观察，明天继续自动汇总情绪、任务和互动情况。";
    }

    private List<String> careServiceSop(String riskLevel, long openAlertCount) {
        if ("high".equals(riskLevel)) {
            return List.of(
                "5 分钟内确认老人安全状态，优先电话联系或现场查看。",
                "记录预警原因、沟通对象和处理结果。",
                "同步家属端处理进度，必要时创建下一次随访。"
            );
        }
        if ("medium".equals(riskLevel) || openAlertCount > 0) {
            return List.of(
                "核对最近情绪、任务完成和留言播放情况。",
                "联系老人或家属确认异常是否持续。",
                "设置一次后续随访，观察 24 小时内变化。"
            );
        }
        return List.of(
            "保持日常巡检，关注情绪和任务趋势。",
            "鼓励家属补充留言或回忆素材。",
            "若连续两天缺少记录，主动发起轻量随访。"
        );
    }

    private String careFamilyMessage(String riskLevel, String reason, String latestServiceText) {
        if (!blank(latestServiceText)) {
            return "服务人员最新反馈：" + latestServiceText;
        }
        if ("high".equals(riskLevel)) {
            return "系统发现需要优先跟进的情况：" + reason + "。建议保持电话畅通，等待服务人员处理结果。";
        }
        if ("medium".equals(riskLevel)) {
            return "今天建议多关注一下：" + reason + "。可以发送一条语音留言或确认照护任务。";
        }
        return "今日照护状态平稳，系统会继续自动观察情绪、任务和互动。";
    }

    private String careElderlyMessage(String riskLevel, long pendingMessages) {
        if ("high".equals(riskLevel)) {
            return "我们已经通知照护人员关注您，请先坐稳休息，需要时可以再次点击求助。";
        }
        if (pendingMessages > 0) {
            return "家人给您留了新消息，可以先听一听，再和小心聊聊天。";
        }
        if ("medium".equals(riskLevel)) {
            return "今天可以慢一点，先完成一个简单任务，再和小心说说感受。";
        }
        return "今天状态不错，照护人员和家人都在关注您。";
    }

    private void auditCareAction(String familyId,
                                 Object elderlyId,
                                 String actorRole,
                                 String actorName,
                                 String actionType,
                                 String summary,
                                 Object detail) {
        if (blank(familyId)) {
            return;
        }
        Object normalizedElderlyId = elderlyId == null || db.string(elderlyId).isBlank() ? null : elderlyId;
        try {
            db.insert("""
                INSERT INTO care_audit_logs (family_id, elderly_id, actor_role, actor_name, action_type, summary, detail)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, familyId, normalizedElderlyId, actorRole, actorName, actionType, summary, db.toJson(detail));
        } catch (Exception ignored) {
        }
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

    private Map<String, Object> mentalScreeningRecord(long id) {
        return db.one("""
            SELECT ms.*, u.name AS elderly_name
            FROM mental_screenings ms
            LEFT JOIN users u ON ms.elderly_id = u.id
            WHERE ms.id = ?
            LIMIT 1
            """, id).orElseGet(LinkedHashMap::new);
    }

    private Map<String, Object> mentalScreeningAnalysis(int completedActions, int livenessScore, int qualityScore) {
        int actionScore = clampScore(completedActions * 25);
        int readiness = (int) Math.round(actionScore * 0.35 + livenessScore * 0.35 + qualityScore * 0.30);
        if (completedActions < 3 || livenessScore < 65 || qualityScore < 55) {
            return db.map(
                "risk_level", "review",
                "risk_score", Math.max(35, 100 - readiness),
                "status_label", "建议复查",
                "summary", "本次现场采集质量不足，暂不生成明确心理风险判断。",
                "recommendation", "建议在光线更好的环境中重新检测，并结合一次简短情绪问卷。"
            );
        }
        if (readiness < 75) {
            return db.map(
                "risk_level", "medium",
                "risk_score", Math.min(72, 100 - readiness + 28),
                "status_label", "建议关注",
                "summary", "本次现场采集完成，但状态信号不够稳定，建议家属进行轻量关怀。",
                "recommendation", "建议今天安排一次电话或语音陪伴，并在 24 小时内复测。"
            );
        }
        return db.map(
            "risk_level", "low",
            "risk_score", Math.max(12, 100 - readiness),
            "status_label", "状态平稳",
            "summary", "本次现场采集完成，未发现需要立即预警的心理风险信号。",
            "recommendation", "保持日常陪伴和规律作息，后续可每周进行一次心理关怀筛查。"
        );
    }

    private int clampScore(int value) {
        return Math.max(0, Math.min(value, 100));
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

    private String elderlyChatUsername(String familyId, long elderlyId) {
        return "elderly:" + familyId + ":" + elderlyId;
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

    private WechatSession resolveWechatSession(String role, String code) throws IOException, InterruptedException {
        if (blank(properties.wechatAppId) || blank(properties.wechatAppSecret)) {
            return new WechatSession("dev-wechat-openid-" + role, "");
        }

        String url = "https://api.weixin.qq.com/sns/jscode2session"
            + "?appid=" + enc(properties.wechatAppId)
            + "&secret=" + enc(properties.wechatAppSecret)
            + "&js_code=" + enc(code)
            + "&grant_type=authorization_code";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(8))
            .GET()
            .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        Map<String, Object> body = mapper.readValue(response.body(), new TypeReference<>() {});
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("code2session returned " + response.statusCode());
        }
        Object errcode = body.get("errcode");
        if (errcode != null && !"0".equals(db.string(errcode))) {
            throw new IOException(db.string(value(body, "errmsg", "invalid wechat code")));
        }

        String openid = db.string(body.get("openid")).trim();
        if (blank(openid)) {
            throw new IOException("wechat openid is empty");
        }
        return new WechatSession(openid, db.string(body.get("unionid")).trim());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private void bindWechatUser(Map<String, Object> user, WechatSession wechatSession, Map<String, Object> userInfo) {
        db.update("""
            UPDATE users
            SET wechat_openid = ?, wechat_unionid = ?, wechat_nickname = ?, wechat_avatar = ?,
                updated_by = 'wechat-login', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            wechatSession.openid(),
            blank(wechatSession.unionid()) ? null : wechatSession.unionid(),
            db.string(userInfo.get("nickName")),
            db.string(userInfo.get("avatarUrl")),
            user.get("id"));
    }

    private void updateWechatProfile(Map<String, Object> user, WechatSession wechatSession, Map<String, Object> userInfo) {
        if (userInfo.isEmpty() && blank(wechatSession.unionid())) {
            return;
        }
        db.update("""
            UPDATE users
            SET wechat_unionid = COALESCE(NULLIF(?, ''), wechat_unionid),
                wechat_nickname = COALESCE(NULLIF(?, ''), wechat_nickname),
                wechat_avatar = COALESCE(NULLIF(?, ''), wechat_avatar),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            wechatSession.unionid(),
            db.string(userInfo.get("nickName")),
            db.string(userInfo.get("avatarUrl")),
            user.get("id"));
    }

    private void updateWechatProfileByOpenid(WechatSession wechatSession, Map<String, Object> userInfo) {
        if (userInfo.isEmpty() && blank(wechatSession.unionid())) {
            return;
        }
        db.update("""
            UPDATE users
            SET wechat_unionid = COALESCE(NULLIF(?, ''), wechat_unionid),
                wechat_nickname = COALESCE(NULLIF(?, ''), wechat_nickname),
                wechat_avatar = COALESCE(NULLIF(?, ''), wechat_avatar),
                updated_at = CURRENT_TIMESTAMP
            WHERE wechat_openid = ? AND is_active = 1
            """,
            wechatSession.unionid(),
            db.string(userInfo.get("nickName")),
            db.string(userInfo.get("avatarUrl")),
            wechatSession.openid());
    }

    private Map<String, Object> identityUser(String openid, String userType) {
        Map<String, Object> user = db.one("""
            SELECT id, user_type, name, phone, family_id, binding_code
            FROM users
            WHERE wechat_openid = ? AND user_type = ? AND is_active = 1
            ORDER BY updated_at DESC, created_at DESC, id DESC
            LIMIT 1
            """, openid, userType).orElse(null);

        if (user == null) {
            return db.map(
                "has_role", false,
                "bound_elderly", false
            );
        }

        long userId = db.longValue(user.get("id"), 0);
        String familyId = db.string(user.get("family_id"));
        Map<String, Object> body = db.map(
            "has_role", true,
            "role", userType,
            "user_id", userId,
            "display_name", user.get("name"),
            "name", user.get("name"),
            "family_id", familyId,
            "binding_code", user.get("binding_code")
        );

        if ("elderly".equals(userType)) {
            body.put("elderly_id", userId);
            body.put("elderly_name", user.get("name"));
            body.put("bound_elderly", true);
            attachSessionToken(body);
            return body;
        }

        body.put("family_user_id", userId);
        Map<String, Object> elderly = db.one("""
            SELECT id, name
            FROM users
            WHERE family_id = ? AND user_type = 'elderly' AND is_active = 1
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """, familyId).orElse(null);
        body.put("bound_elderly", elderly != null);
        if (elderly != null) {
            body.put("elderly_id", elderly.get("id"));
            body.put("elderly_name", elderly.get("name"));
        }
        attachSessionToken(body);
        return body;
    }

    private Map<String, Object> serviceIdentity(String openid) {
        if (!blank(properties.serviceWechatOpenid) && properties.serviceWechatOpenid.equals(openid)) {
            Map<String, Object> body = db.map(
                "has_role", true,
                "role", "service",
                "certified", true,
                "status", "approved",
                "openid", openid,
                "username", "wechat-service",
                "display_name", properties.serviceDisplayName,
                "family_id", properties.serviceFamilyId
            );
            attachSessionToken(body);
            return body;
        }

        Map<String, Object> certification = db.one("""
            SELECT name, phone, staff_no, organization, status, reject_reason
            FROM service_certifications
            WHERE wechat_openid = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """, openid).orElse(null);
        if (certification == null) {
            return db.map(
                "has_role", false,
                "certified", false,
                "status", "none"
            );
        }

        String status = db.string(certification.get("status")).trim().toLowerCase();
        if (!List.of("pending", "approved", "rejected").contains(status)) {
            status = "pending";
        }

        Map<String, Object> body = db.map(
            "has_role", "approved".equals(status),
            "role", "service",
            "certified", "approved".equals(status),
            "status", status,
            "openid", openid,
            "username", db.string(certification.get("staff_no")),
            "display_name", db.string(certification.get("name")),
            "family_id", properties.serviceFamilyId,
            "organization", db.string(certification.get("organization")),
            "staff_no", db.string(certification.get("staff_no")),
            "phone", db.string(certification.get("phone"))
        );
        if ("rejected".equals(status)) {
            body.put("reason", db.string(certification.get("reject_reason")));
        }
        if ("approved".equals(status)) {
            attachSessionToken(body);
        }
        return body;
    }

    private ResponseEntity<Map<String, Object>> loginUser(String userType, String username, String password) {
        Map<String, Object> account = db.one("""
            SELECT id, role, username, display_name, password_hash, permissions, user_id, family_id,
                   disabled, failed_login_count, session_version, locked_until
            FROM auth_accounts
            WHERE role = ? AND LOWER(username) = LOWER(?)
            LIMIT 1
            """, userType, username).orElse(null);
        if (account != null) {
            return loginDatabaseUser(userType, username, password, account);
        }

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

        return ok(userLoginBody(userType, user));
    }

    private ResponseEntity<Map<String, Object>> loginDatabaseUser(String userType,
                                                                  String username,
                                                                  String password,
                                                                  Map<String, Object> account) {
        long accountId = db.longValue(account.get("id"), 0);
        String familyId = db.string(account.get("family_id"));
        if (db.boolValue(account.get("disabled"))) {
            auditAuthAction(accountId, userType, username, "login_blocked", false, "account disabled", familyId);
            return status(HttpStatus.FORBIDDEN, db.map("error", "account is disabled"));
        }

        LocalDateTime lockedUntil = db.parseDateTime(account.get("locked_until"));
        if (lockedUntil != null && lockedUntil.isAfter(LocalDateTime.now(properties.zoneId))) {
            auditAuthAction(accountId, userType, username, "login_blocked", false, "account locked", familyId);
            return status(HttpStatus.LOCKED, db.map("error", "account is temporarily locked"));
        }

        if (!PasswordHasher.verify(password, db.string(account.get("password_hash")))) {
            recordFailedAuthLogin(account);
            auditAuthAction(accountId, userType, username, "login_failed", false, "bad credentials", familyId);
            return unauthorized("username or password is incorrect");
        }

        long userId = db.longValue(account.get("user_id"), 0);
        if (userId <= 0) {
            auditAuthAction(accountId, userType, username, "login_blocked", false, "account missing user binding", familyId);
            return status(HttpStatus.FORBIDDEN, db.map("error", "account is not bound to an active user"));
        }

        Map<String, Object> user = db.one("""
            SELECT id, user_type, name, phone, family_id, binding_code
            FROM users
            WHERE id = ? AND user_type = ? AND is_active = 1
            LIMIT 1
            """, userId, userType).orElse(null);
        if (user == null) {
            auditAuthAction(accountId, userType, username, "login_blocked", false, "bound user inactive or missing", familyId);
            return status(HttpStatus.FORBIDDEN, db.map("error", "account is not bound to an active user"));
        }

        db.update("""
            UPDATE auth_accounts
            SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, accountId);
        auditAuthAction(accountId, userType, username, "login_success", true, "", familyId);

        Map<String, Object> body = userLoginBody(userType, user);
        body.put("username", account.get("username"));
        body.put("auth_account_id", accountId);
        body.put("session_version", db.intValue(account.get("session_version"), 1));
        body.put("permissions", db.jsonList(account.get("permissions")).stream()
            .map(String::valueOf)
            .filter(value -> !value.isBlank())
            .toList());
        attachSessionToken(body);
        return ok(body);
    }

    private ResponseEntity<Map<String, Object>> loginWechatUser(String userType, WechatSession wechatSession, Map<String, Object> userInfo) {
        Map<String, Object> user = db.one("""
            SELECT id, user_type, name, phone, family_id, binding_code, wechat_openid
            FROM users
            WHERE user_type = ? AND is_active = 1 AND wechat_openid = ?
            ORDER BY created_at
            LIMIT 1
            """, userType, wechatSession.openid()).orElse(null);

        if (user == null) {
            user = db.one("""
                SELECT id, user_type, name, phone, family_id, binding_code, wechat_openid
                FROM users
                WHERE user_type = ? AND is_active = 1 AND (wechat_openid IS NULL OR wechat_openid = '')
                ORDER BY created_at
                LIMIT 1
                """, userType).orElse(null);
            if (user == null) {
                return notFound("wechat account is not bound");
            }
            bindWechatUser(user, wechatSession, userInfo);
        } else {
            updateWechatProfile(user, wechatSession, userInfo);
        }

        return ok(userLoginBody(userType, user));
    }

    private ResponseEntity<Map<String, Object>> loginWechatService(String openid) {
        if (!blank(properties.serviceWechatOpenid) && !properties.serviceWechatOpenid.equals(openid)) {
            return unauthorized("wechat account is not allowed for service role");
        }

        Map<String, Object> body = db.map(
            "success", true,
            "role", "service",
            "openid", openid,
            "username", "wechat-service",
            "display_name", properties.serviceDisplayName,
            "family_id", properties.serviceFamilyId
        );
        attachSessionToken(body);
        return ok(body);
    }

    private Map<String, Object> userLoginBody(String userType, Map<String, Object> user) {
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

        attachSessionToken(body);
        return body;
    }

    private ResponseEntity<Map<String, Object>> loginOperator(String role, String username, String password) {
        Map<String, Object> account = db.one("""
            SELECT id, role, username, display_name, password_hash, permissions, organization_id, family_id,
                   disabled, failed_login_count, session_version, locked_until
            FROM auth_accounts
            WHERE role = ? AND LOWER(username) = LOWER(?)
            LIMIT 1
            """, role, username).orElse(null);
        if (account != null) {
            return loginDatabaseOperator(role, username, password, account);
        }

        if (properties.staticOperatorLoginEnabled) {
            return loginStaticOperator(role, username, password);
        }

        auditAuthAction(null, role, username, "login_failed", false, "account not found", "");
        return unauthorized("username or password is incorrect");
    }

    private ResponseEntity<Map<String, Object>> loginDatabaseOperator(String role,
                                                                      String username,
                                                                      String password,
                                                                      Map<String, Object> account) {
        long accountId = db.longValue(account.get("id"), 0);
        String familyId = db.string(account.get("family_id"));
        if (db.boolValue(account.get("disabled"))) {
            auditAuthAction(accountId, role, username, "login_blocked", false, "account disabled", familyId);
            return status(HttpStatus.FORBIDDEN, db.map("error", "account is disabled"));
        }

        LocalDateTime lockedUntil = db.parseDateTime(account.get("locked_until"));
        if (lockedUntil != null && lockedUntil.isAfter(LocalDateTime.now(properties.zoneId))) {
            auditAuthAction(accountId, role, username, "login_blocked", false, "account locked", familyId);
            return status(HttpStatus.LOCKED, db.map("error", "account is temporarily locked"));
        }

        if (!PasswordHasher.verify(password, db.string(account.get("password_hash")))) {
            recordFailedAuthLogin(account);
            auditAuthAction(accountId, role, username, "login_failed", false, "bad credentials", familyId);
            return unauthorized("username or password is incorrect");
        }

        db.update("""
            UPDATE auth_accounts
            SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, accountId);
        auditAuthAction(accountId, role, username, "login_success", true, "", familyId);

        List<String> permissions = db.jsonList(account.get("permissions")).stream()
            .map(String::valueOf)
            .filter(value -> !value.isBlank())
            .toList();
        Map<String, Object> body = db.map(
            "success", true,
            "role", role,
            "user_id", accountId,
            "auth_account_id", accountId,
            "session_version", db.intValue(account.get("session_version"), 1),
            "username", account.get("username"),
            "display_name", blank(db.string(account.get("display_name"))) ? username : account.get("display_name"),
            "permissions", permissions
        );
        String organizationId = db.string(account.get("organization_id"));
        if (!blank(organizationId)) {
            body.put("organization_id", organizationId);
        }
        if (!blank(familyId)) {
            body.put("family_id", familyId);
            body.put("family_ids", List.of(familyId));
        }
        attachSessionToken(body);
        return ok(body);
    }

    private ResponseEntity<Map<String, Object>> loginStaticOperator(String role, String username, String password) {
        String expectedUsername = "service".equals(role) ? properties.serviceUsername : properties.adminUsername;
        String expectedPassword = "service".equals(role) ? properties.servicePassword : properties.adminPassword;
        String displayName = "service".equals(role) ? properties.serviceDisplayName : properties.adminDisplayName;
        if (!expectedUsername.equalsIgnoreCase(username) || !expectedPassword.equals(password)) {
            return unauthorized("username or password is incorrect");
        }

        Map<String, Object> body = db.map(
            "success", true,
            "role", role,
            "username", username,
            "display_name", displayName,
            "permissions", List.of(role + ":legacy")
        );
        if ("service".equals(role)) {
            body.put("family_id", properties.serviceFamilyId);
            body.put("family_ids", List.of(properties.serviceFamilyId));
        }
        auditAuthAction(null, role, username, "legacy_login_success", true, "", db.string(body.get("family_id")));
        attachSessionToken(body);
        return ok(body);
    }

    private void recordFailedAuthLogin(Map<String, Object> account) {
        long accountId = db.longValue(account.get("id"), 0);
        int failed = db.intValue(account.get("failed_login_count"), 0) + 1;
        Timestamp lockedUntil = failed >= 5 ? Timestamp.valueOf(LocalDateTime.now(properties.zoneId).plusMinutes(15)) : null;
        db.update("""
            UPDATE auth_accounts
            SET failed_login_count = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, failed, lockedUntil, accountId);
    }

    private void auditAuthAction(Object accountId,
                                 String role,
                                 String username,
                                 String actionType,
                                 boolean success,
                                 String reason,
                                 String familyId) {
        try {
            db.insert("""
                INSERT INTO auth_audit_logs (account_id, role, username, action_type, success, reason, family_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, accountId, role, username, actionType, success ? 1 : 0, reason, familyId);
        } catch (Exception ignored) {
        }
    }

    private void attachSessionToken(Map<String, Object> body) {
        body.put("session_token", createSessionToken(body));
        body.put("session_expires_in", properties.sessionTtlSeconds);
    }

    private String createSessionToken(Map<String, Object> body) {
        return SessionTokenCodec.create(body, properties, mapper);
    }

    private Map<String, Object> verifySessionToken(String token) {
        return SessionTokenCodec.verify(token, properties, mapper);
    }

    private String extractSessionToken(String sessionToken, String authorization) {
        return SessionTokenCodec.extract(sessionToken, authorization, properties);
    }

    private ResponseEntity<Map<String, Object>> requireAdminSession(String sessionToken, String authorization, String requiredPermission) {
        String token = extractSessionToken(sessionToken, authorization);
        if (blank(token)) {
            return unauthorized("missing admin session token");
        }
        Map<String, Object> payload = verifySessionToken(token);
        if (payload == null) {
            return unauthorized("invalid admin session token");
        }
        if (!"admin".equals(db.string(payload.get("role")))) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "admin role is required"));
        }
        if (!blank(requiredPermission) && !sessionHasPermission(payload.get("permissions"), requiredPermission)) {
            return status(HttpStatus.FORBIDDEN, db.map("error", "admin permission is required"));
        }
        return null;
    }

    private boolean sessionHasPermission(Object raw, String requiredPermission) {
        if (raw instanceof Iterable<?> values) {
            for (Object value : values) {
                if (permissionMatches(db.string(value), requiredPermission)) {
                    return true;
                }
            }
            return false;
        }
        for (String part : db.string(raw).split(",")) {
            if (permissionMatches(part, requiredPermission)) {
                return true;
            }
        }
        return false;
    }

    private boolean permissionMatches(String value, String requiredPermission) {
        String permission = db.string(value).trim();
        return permission.equals(requiredPermission)
            || permission.equals("admin:*")
            || permission.equals("admin:legacy");
    }

    private boolean strongAccountPassword(String password) {
        return password != null && password.trim().length() >= 12;
    }

    private boolean confirmedAdminAction(Map<String, Object> data) {
        return db.boolValue(data.get("confirmed"))
            || db.boolValue(data.get("confirm"))
            || "CONFIRM".equalsIgnoreCase(db.string(data.get("confirmation")).trim());
    }

    private List<String> permissionsFromRequest(Object raw, String role) {
        List<Object> values;
        if (raw instanceof String text) {
            String trimmed = text.trim();
            if (trimmed.isBlank()) {
                values = List.of();
            } else if (trimmed.startsWith("[")) {
                values = db.jsonList(trimmed);
            } else {
                values = Arrays.stream(trimmed.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .map(value -> (Object) value)
                    .toList();
            }
        } else {
            values = db.jsonList(raw);
        }
        List<String> permissions = values.stream()
            .map(String::valueOf)
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .distinct()
            .toList();
        return permissions.isEmpty() ? List.of(role + ":*") : permissions;
    }

    private boolean matchesLoginPassword(Map<String, Object> user, String password) {
        String phone = db.string(user.get("phone")).replaceAll("\\D+", "");
        if (properties.phoneSuffixLoginEnabled && phone.length() >= 6 && password.equals(phone.substring(phone.length() - 6))) {
            return true;
        }
        return !blank(properties.demoLoginPassword) && password.equals(properties.demoLoginPassword);
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
        if (body != null && body.containsKey("error") && !body.containsKey("code")) {
            Map<String, Object> enriched = new LinkedHashMap<>(body);
            String message = db.string(enriched.get("error"));
            enriched.put("code", defaultErrorCode(status));
            enriched.put("message", message);
            enriched.put("request_id", UUID.randomUUID().toString());
            return ResponseEntity.status(status).body(enriched);
        }
        return ResponseEntity.status(status).body(body);
    }

    private String defaultErrorCode(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "bad_request";
            case UNAUTHORIZED -> "unauthorized";
            case FORBIDDEN -> "forbidden";
            case NOT_FOUND -> "not_found";
            case CONFLICT -> "conflict";
            case LOCKED -> "account_locked";
            case UNPROCESSABLE_ENTITY -> "unprocessable_entity";
            case INTERNAL_SERVER_ERROR -> "internal_error";
            case BAD_GATEWAY -> "bad_gateway";
            default -> status.name().toLowerCase(Locale.ROOT);
        };
    }

    private record WechatSession(String openid, String unionid) {
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
