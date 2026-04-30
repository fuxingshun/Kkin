package com.kinecho.server.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class KinEchoMapper {
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final JdbcTemplate jdbc;
    private final KinEchoProperties properties;
    private final ObjectMapper mapper;

    public KinEchoMapper(JdbcTemplate jdbc, KinEchoProperties properties, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.mapper = mapper;
    }

    public void initialize() {
        createTables();
        migrateSchema();
        createIndexes();
        if (properties.seedDemoData) {
            seedDemoData();
        }
    }

    public boolean isMysql() {
        return properties.isMysql();
    }

    public String readColumn() {
        return isMysql() ? "`read`" : "read";
    }

    public String nowSql() {
        return "CURRENT_TIMESTAMP";
    }

    public String nowString() {
        return LocalDateTime.now(properties.zoneId).format(DATE_TIME);
    }

    public List<Map<String, Object>> list(String sql, Object... args) {
        return normalizeList(jdbc.queryForList(sql, args));
    }

    public Optional<Map<String, Object>> one(String sql, Object... args) {
        List<Map<String, Object>> rows = list(sql, args);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long count(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    public int update(String sql, Object... args) {
        return jdbc.update(sql, args);
    }

    public long insert(String sql, Object... args) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        PreparedStatementCreator creator = (Connection connection) -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i + 1, args[i]);
            }
            return ps;
        };
        jdbc.update(creator, keyHolder);
        Number key = keyHolder.getKey();
        return key == null ? 0 : key.longValue();
    }

    public List<Map<String, Object>> normalizeList(List<Map<String, Object>> rows) {
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            normalized.add(normalizeMap(row));
        }
        return normalized;
    }

    public Map<String, Object> normalizeMap(Map<String, Object> row) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            normalized.put(entry.getKey(), normalizeValue(entry.getValue()));
        }
        return normalized;
    }

    public Object normalizeValue(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().format(DATE_TIME);
        }
        if (value instanceof Date date) {
            return date.toLocalDate().toString();
        }
        if (value instanceof java.util.Date date) {
            return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault()).format(DATE_TIME);
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.scale() <= 0 ? decimal.longValue() : decimal.doubleValue();
        }
        if (value instanceof BigInteger integer) {
            return integer.longValue();
        }
        if (value instanceof Byte b) {
            return b.intValue();
        }
        return value;
    }

    public Map<String, Object> ok() {
        return map("success", true);
    }

    public Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i + 1 < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    public String toJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return "[]";
        }
    }

    public List<Object> jsonList(Object value) {
        if (value instanceof Collection<?> collection) {
            return new ArrayList<>(collection);
        }
        if (value == null || value.toString().isBlank()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(value.toString(), new TypeReference<List<Object>>() {});
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    public Map<String, Object> jsonMap(Object value) {
        if (value instanceof Map<?, ?> raw) {
            Map<String, Object> result = new LinkedHashMap<>();
            raw.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }
        if (value == null || value.toString().isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return mapper.readValue(value.toString(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
        }
    }

    public int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    public long longValue(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return fallback;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    public boolean boolValue(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        return value != null && ("true".equalsIgnoreCase(value.toString()) || "1".equals(value.toString()));
    }

    public String string(Object value) {
        return value == null ? "" : value.toString();
    }

    public LocalDateTime parseDateTime(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().replace('T', ' ').trim();
        if (text.isBlank()) {
            return null;
        }
        if (text.length() == 16) {
            text += ":00";
        }
        try {
            return LocalDateTime.parse(text.substring(0, Math.min(19, text.length())), DATE_TIME);
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(text);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    public List<Integer> parseRepeatDays(Object value) {
        List<Integer> result = new ArrayList<>();
        for (Object item : jsonList(value)) {
            try {
                result.add(Integer.parseInt(String.valueOf(item)));
            } catch (NumberFormatException ignored) {
            }
        }
        if (!result.isEmpty() || value == null) {
            return result;
        }
        for (String token : value.toString().split("[^0-9]+")) {
            if (!token.isBlank()) {
                result.add(Integer.parseInt(token));
            }
        }
        return result;
    }

    public void upsertMediaFeedback(long mediaId, long elderlyId, String feedbackType) {
        if (isMysql()) {
            update("""
                INSERT INTO media_feedback (media_id, elderly_id, feedback_type)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE feedback_type = VALUES(feedback_type), created_at = CURRENT_TIMESTAMP
                """, mediaId, elderlyId, feedbackType);
            return;
        }
        update("""
            INSERT OR REPLACE INTO media_feedback (media_id, elderly_id, feedback_type)
            VALUES (?, ?, ?)
            """, mediaId, elderlyId, feedbackType);
    }

    private void createTables() {
        String id = isMysql() ? "BIGINT AUTO_INCREMENT PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
        String text = isMysql() ? "TEXT" : "TEXT";
        String varchar32 = isMysql() ? "VARCHAR(32)" : "TEXT";
        String varchar64 = isMysql() ? "VARCHAR(64)" : "TEXT";
        String varchar191 = isMysql() ? "VARCHAR(191)" : "TEXT";
        String integer = isMysql() ? "INT" : "INTEGER";
        String bigInt = isMysql() ? "BIGINT" : "INTEGER";
        String uniqueMediaFeedback = isMysql() ? "UNIQUE KEY uq_media_feedback (media_id, elderly_id)" : "UNIQUE(media_id, elderly_id)";

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id %s,
                user_type %s NOT NULL,
                name %s NOT NULL,
                phone %s,
                family_id %s,
                binding_code %s,
                is_active %s DEFAULT 1,
                created_by %s,
                updated_by %s,
                deleted_by %s,
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar32, text, varchar64, varchar64, varchar32, integer, varchar64, varchar64, varchar64));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS ai_interactions (
                id %s,
                username %s NOT NULL DEFAULT 'User',
                type %s NOT NULL,
                way %s NOT NULL DEFAULT 'speak',
                content %s NOT NULL,
                createtime %s NOT NULL,
                timetext %s,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar191, varchar32, varchar64, text, bigInt, text));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS schedules (
                id %s,
                family_id %s NOT NULL,
                title %s NOT NULL,
                description %s,
                schedule_type %s,
                schedule_time TIMESTAMP NOT NULL,
                repeat_type %s DEFAULT 'once',
                repeat_days %s,
                status %s DEFAULT 'pending',
                completed_at TIMESTAMP,
                auto_remind %s DEFAULT 1,
                is_active %s DEFAULT 1,
                created_by %s,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, text, text, varchar64, varchar64, text, varchar64, integer, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id %s,
                schedule_id %s NOT NULL,
                elderly_id %s NOT NULL,
                remind_time TIMESTAMP NOT NULL,
                status %s DEFAULT 'pending',
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, integer, integer, varchar64));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id %s,
                family_id %s NOT NULL,
                media_type %s NOT NULL,
                title %s NOT NULL,
                description %s,
                file_path %s NOT NULL,
                file_size %s,
                duration %s,
                thumbnail_path %s,
                uploaded_by %s,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, varchar32, text, text, text, bigInt, integer, text, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS media_tags (
                id %s,
                media_id %s NOT NULL,
                tag %s NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, integer, text));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS media_policies (
                id %s,
                media_id %s NOT NULL,
                time_windows %s,
                moods %s,
                occasions %s,
                cooldown %s DEFAULT 60,
                priority %s DEFAULT 5,
                last_played_at TIMESTAMP,
                play_count %s DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, integer, text, text, text, integer, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS media_play_history (
                id %s,
                media_id %s NOT NULL,
                elderly_id %s NOT NULL,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration_watched %s,
                completed %s DEFAULT 0,
                triggered_by %s,
                mood_before %s,
                mood_after %s
            )
            """.formatted(id, integer, integer, integer, integer, varchar64, text, text));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS media_feedback (
                id %s,
                media_id %s NOT NULL,
                elderly_id %s NOT NULL,
                feedback_type %s NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                %s
            )
            """.formatted(id, integer, integer, varchar32, uniqueMediaFeedback));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS family_messages (
                id %s,
                family_id %s NOT NULL,
                content %s NOT NULL,
                sender_name %s NOT NULL,
                sender_relation %s NOT NULL,
                scheduled_time TIMESTAMP NOT NULL,
                played %s DEFAULT 0,
                played_at TIMESTAMP,
                liked %s DEFAULT 0,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, text, text, text, integer, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS family_alerts (
                id %s,
                family_id %s NOT NULL,
                elderly_id %s,
                alert_type %s NOT NULL,
                level %s NOT NULL,
                title %s,
                message %s NOT NULL,
                metadata %s,
                source %s DEFAULT 'elderly',
                handled %s DEFAULT 0,
                handled_at TIMESTAMP,
                handled_by %s,
                reply_message %s,
                %s %s DEFAULT 0,
                read_at TIMESTAMP,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, integer, varchar64, varchar32, text, text, text, varchar64,
            integer, integer, text, readColumn(), integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS mood_records (
                id %s,
                family_id %s NOT NULL,
                elderly_id %s,
                mood_type %s NOT NULL,
                mood_score %s DEFAULT 5,
                note %s,
                source %s DEFAULT 'manual',
                trigger_event %s,
                location %s,
                weather %s,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, integer, varchar64, integer, text, varchar64, text, text, text));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS counselors (
                id %s,
                name %s NOT NULL,
                title %s NOT NULL,
                experience %s,
                specialty %s,
                rating %s,
                avatar %s,
                available %s DEFAULT 1,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, text, text, text, text, text, text, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS consultations (
                id %s,
                family_id %s NOT NULL,
                elderly_id %s,
                counselor_id %s,
                consultation_type %s DEFAULT 'phone',
                scheduled_time TIMESTAMP NOT NULL,
                duration %s DEFAULT 45,
                status %s DEFAULT 'scheduled',
                note %s,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, integer, integer, varchar64, integer, varchar64, text));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS care_audit_logs (
                id %s,
                family_id %s NOT NULL,
                elderly_id %s,
                actor_role %s NOT NULL,
                actor_name %s,
                action_type %s NOT NULL,
                summary %s,
                detail %s,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, integer, varchar32, varchar64, varchar64, text, text));
    }

    private void migrateSchema() {
        String integer = isMysql() ? "INT" : "INTEGER";
        String bigInt = isMysql() ? "BIGINT" : "INTEGER";
        String varchar32 = isMysql() ? "VARCHAR(32)" : "TEXT";
        String varchar64 = isMysql() ? "VARCHAR(64)" : "TEXT";
        String text = "TEXT";

        migrateColumns("users", List.of(
            "is_active " + integer + " DEFAULT 1",
            "binding_code " + varchar32,
            "created_by " + varchar64,
            "updated_by " + varchar64,
            "deleted_by " + varchar64,
            "deleted_at TIMESTAMP",
            "updated_at TIMESTAMP"
        ));
        migrateColumns("ai_interactions", List.of(
            "way " + varchar64 + " DEFAULT 'speak'",
            "timetext " + text,
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("schedules", List.of(
            "description " + text,
            "schedule_type " + varchar64,
            "repeat_type " + varchar64 + " DEFAULT 'once'",
            "repeat_days " + text,
            "status " + varchar64 + " DEFAULT 'pending'",
            "completed_at TIMESTAMP",
            "auto_remind " + integer + " DEFAULT 1",
            "is_active " + integer + " DEFAULT 1",
            "created_by " + varchar64,
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("reminders", List.of(
            "status " + varchar64 + " DEFAULT 'pending'",
            "completed_at TIMESTAMP"
        ));
        migrateColumns("media", List.of(
            "description " + text,
            "file_size " + bigInt,
            "duration " + integer,
            "thumbnail_path " + text,
            "uploaded_by " + bigInt,
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("media_policies", List.of(
            "time_windows " + text,
            "moods " + text,
            "occasions " + text,
            "cooldown " + integer + " DEFAULT 60",
            "priority " + integer + " DEFAULT 5",
            "last_played_at TIMESTAMP",
            "play_count " + integer + " DEFAULT 0",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("media_play_history", List.of(
            "duration_watched " + integer,
            "completed " + integer + " DEFAULT 0",
            "triggered_by " + varchar64,
            "mood_before " + text,
            "mood_after " + text
        ));
        migrateColumns("family_messages", List.of(
            "played " + integer + " DEFAULT 0",
            "played_at TIMESTAMP",
            "liked " + integer + " DEFAULT 0",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("family_alerts", List.of(
            "elderly_id " + bigInt,
            "title " + text,
            "metadata " + text,
            "source " + varchar64 + " DEFAULT 'elderly'",
            "handled " + integer + " DEFAULT 0",
            "handled_at TIMESTAMP",
            "handled_by " + varchar64,
            "reply_message " + text,
            readColumn() + " " + integer + " DEFAULT 0",
            "read_at TIMESTAMP",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("mood_records", List.of(
            "elderly_id " + bigInt,
            "mood_score " + integer + " DEFAULT 5",
            "note " + text,
            "source " + varchar64 + " DEFAULT 'manual'",
            "trigger_event " + text,
            "location " + text,
            "weather " + text,
            "recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("counselors", List.of(
            "experience " + text,
            "specialty " + text,
            "rating " + text,
            "avatar " + text,
            "available " + integer + " DEFAULT 1",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("consultations", List.of(
            "elderly_id " + bigInt,
            "counselor_id " + bigInt,
            "consultation_type " + varchar64 + " DEFAULT 'phone'",
            "duration " + integer + " DEFAULT 45",
            "status " + varchar64 + " DEFAULT 'scheduled'",
            "note " + text,
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("media_feedback", List.of(
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("care_audit_logs", List.of(
            "family_id " + varchar64,
            "elderly_id " + bigInt,
            "actor_role " + varchar32,
            "actor_name " + varchar64,
            "action_type " + varchar64,
            "summary " + text,
            "detail " + text,
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));

        safeUpdate("UPDATE users SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE ai_interactions SET way = 'speak' WHERE way IS NULL");
        safeUpdate("UPDATE schedules SET repeat_type = 'once' WHERE repeat_type IS NULL OR repeat_type = ''");
        safeUpdate("UPDATE schedules SET status = 'pending' WHERE status IS NULL OR status = ''");
        safeUpdate("UPDATE schedules SET auto_remind = 1 WHERE auto_remind IS NULL");
        safeUpdate("UPDATE schedules SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE schedules SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE reminders SET status = 'pending' WHERE status IS NULL OR status = ''");
        safeUpdate("UPDATE media SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE media SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE media_policies SET cooldown = 60 WHERE cooldown IS NULL");
        safeUpdate("UPDATE media_policies SET priority = 5 WHERE priority IS NULL");
        safeUpdate("UPDATE media_policies SET play_count = 0 WHERE play_count IS NULL");
        safeUpdate("UPDATE media_policies SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE family_messages SET played = 0 WHERE played IS NULL");
        safeUpdate("UPDATE family_messages SET liked = 0 WHERE liked IS NULL");
        safeUpdate("UPDATE family_messages SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE family_messages SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE family_alerts SET source = 'elderly' WHERE source IS NULL OR source = ''");
        safeUpdate("UPDATE family_alerts SET handled = 0 WHERE handled IS NULL");
        safeUpdate("UPDATE family_alerts SET %s = 0 WHERE %s IS NULL".formatted(readColumn(), readColumn()));
        safeUpdate("UPDATE family_alerts SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE family_alerts SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE mood_records SET mood_score = 5 WHERE mood_score IS NULL");
        safeUpdate("UPDATE mood_records SET source = 'manual' WHERE source IS NULL OR source = ''");
        safeUpdate("UPDATE mood_records SET recorded_at = created_at WHERE recorded_at IS NULL");
        safeUpdate("UPDATE counselors SET available = 1 WHERE available IS NULL");
        safeUpdate("UPDATE counselors SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE counselors SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE consultations SET consultation_type = 'phone' WHERE consultation_type IS NULL OR consultation_type = ''");
        safeUpdate("UPDATE consultations SET duration = 45 WHERE duration IS NULL");
        safeUpdate("UPDATE consultations SET status = 'scheduled' WHERE status IS NULL OR status = ''");
        safeUpdate("UPDATE consultations SET updated_at = created_at WHERE updated_at IS NULL");
    }

    private void migrateColumns(String table, List<String> definitions) {
        for (String definition : definitions) {
            addColumn(table, definition);
        }
    }

    private void addColumn(String table, String definition) {
        try {
            jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + definition);
        } catch (Exception ignored) {
        }
    }

    private void safeUpdate(String sql) {
        try {
            jdbc.update(sql);
        } catch (Exception ignored) {
        }
    }

    private void createIndexes() {
        createIndex("idx_users_family_active", "users", "family_id, is_active, user_type");
        createIndex("idx_users_binding_code", "users", "binding_code");
        createIndex("idx_mood_records_family_id", "mood_records", "family_id");
        createIndex("idx_mood_records_elderly_id", "mood_records", "elderly_id");
        createIndex("idx_mood_records_recorded_at", "mood_records", "recorded_at DESC");
        createIndex("idx_family_alerts_family_id", "family_alerts", "family_id");
        createIndex("idx_family_alerts_created_at", "family_alerts", "created_at DESC");
        createIndex("idx_family_alerts_handled", "family_alerts", "handled, created_at DESC");
        createIndex("idx_care_audit_family_created", "care_audit_logs", "family_id, created_at DESC");
        createIndex("idx_care_audit_elderly_created", "care_audit_logs", "elderly_id, created_at DESC");
    }

    private void createIndex(String name, String table, String columns) {
        try {
            String exists = isMysql() ? "" : "IF NOT EXISTS ";
            jdbc.execute("CREATE INDEX " + exists + name + " ON " + table + "(" + columns + ")");
        } catch (Exception ignored) {
        }
    }

    private void seedDemoData() {
        String familyId = "family_001";
        if (count("SELECT COUNT(*) FROM users WHERE family_id = ? AND is_active = 1", familyId) == 0) {
            insert("INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)", "elderly", "张翠芬", "13800138000", familyId);
            insert("INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)", "family", "李小雨", "13800135678", familyId);
            insert("INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)", "family", "张明", "13900139012", familyId);
        }
        if (count("SELECT COUNT(*) FROM schedules WHERE family_id = ? AND is_active = 1", familyId) == 0) {
            LocalDate today = LocalDate.now(properties.zoneId);
            List<Object[]> schedules = List.of(
                new Object[]{"服药提醒", "早餐后服用降压药", "medication", today + " 08:00:00", "daily"},
                new Object[]{"饮水提醒", "记得喝一杯温水", "meal", today + " 10:00:00", "daily"},
                new Object[]{"活动提醒", "下午散步30分钟", "exercise", today + " 15:00:00", "daily"},
                new Object[]{"睡眠提醒", "准备休息，保持良好作息", "other", today + " 21:00:00", "daily"}
            );
            for (Object[] item : schedules) {
                insert("""
                    INSERT INTO schedules (family_id, title, description, schedule_type, schedule_time, repeat_type, status, auto_remind, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, 1)
                    """, familyId, item[0], item[1], item[2], item[3], item[4]);
            }
        }
        if (count("SELECT COUNT(*) FROM family_messages WHERE family_id = ? AND is_active = 1", familyId) == 0) {
            String scheduledTime = LocalDateTime.now(properties.zoneId).minusMinutes(10).format(DATE_TIME);
            insert("""
                INSERT INTO family_messages (family_id, content, sender_name, sender_relation, scheduled_time, played, liked, is_active)
                VALUES (?, ?, ?, ?, ?, 0, 0, 1)
                """, familyId, "妈妈，记得按时吃药，下午我会视频通话看看您。", "小雨", "女儿", scheduledTime);
        }
        if (count("SELECT COUNT(*) FROM counselors") == 0) {
            insert("""
                INSERT INTO counselors (name, title, experience, specialty, rating, avatar, available, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, "李心怡", "资深心理咨询师", "15年", "老年心理、情绪疏导", "4.9", "李", 1);
            insert("""
                INSERT INTO counselors (name, title, experience, specialty, rating, avatar, available, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, "王建国", "心理治疗师", "12年", "焦虑调节、睡眠改善", "4.8", "王", 1);
        }
    }
}
