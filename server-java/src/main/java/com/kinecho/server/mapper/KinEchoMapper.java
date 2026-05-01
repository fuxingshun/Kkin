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
        seedCounselors();
        createIndexes();
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
                wechat_openid %s,
                wechat_unionid %s,
                wechat_nickname %s,
                wechat_avatar %s,
                is_active %s DEFAULT 1,
                created_by %s,
                updated_by %s,
                deleted_by %s,
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar32, text, varchar64, varchar64, varchar32, varchar191, varchar191, text, text, integer, varchar64, varchar64, varchar64));

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
            CREATE TABLE IF NOT EXISTS mental_screenings (
                id %s,
                family_id %s NOT NULL,
                elderly_id %s,
                capture_mode %s DEFAULT 'live_camera',
                risk_level %s NOT NULL,
                risk_score %s DEFAULT 0,
                status_label %s,
                summary %s,
                recommendation %s,
                frame_path %s,
                frame_count %s DEFAULT 0,
                completed_actions %s DEFAULT 0,
                liveness_score %s DEFAULT 0,
                quality_score %s DEFAULT 0,
                consent_version %s,
                source %s DEFAULT 'elderly',
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar64, integer, varchar64, varchar32, integer, text, text, text, text, integer, integer, integer, integer, varchar64, varchar64, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS counselors (
                id %s,
                name %s NOT NULL,
                title %s NOT NULL,
                experience %s,
                specialty %s,
                rating %s,
                avatar %s,
                price %s DEFAULT 300,
                discount_price %s DEFAULT 210,
                education %s,
                tags %s,
                experience_stats %s,
                availability_text %s,
                format_text %s,
                location %s,
                specialties %s,
                packages %s,
                calendar %s,
                notices %s,
                hero_emoji %s,
                hero_hint %s,
                brand_text %s,
                available %s DEFAULT 1,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, text, text, text, text, text, text, integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer));

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
            CREATE TABLE IF NOT EXISTS psychology_videos (
                id %s,
                slug %s NOT NULL,
                title %s NOT NULL,
                category %s,
                duration %s,
                speaker %s,
                summary %s,
                poster_url %s,
                source_url %s NOT NULL,
                license %s,
                cover_class_name %s,
                takeaways %s,
                sort_order %s DEFAULT 0,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, varchar191, text, text, varchar64, text, text, text, text, text, varchar64, text, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS psychology_categories (
                id %s,
                name %s NOT NULL,
                icon %s,
                class_name %s,
                sort_order %s DEFAULT 0,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, text, varchar64, varchar64, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS psychology_questions (
                id %s,
                question %s NOT NULL,
                sort_order %s DEFAULT 0,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, text, integer, integer));

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS psychology_question_replies (
                id %s,
                question_id %s NOT NULL,
                reply_type %s NOT NULL,
                author_name %s NOT NULL,
                author_role %s,
                content %s NOT NULL,
                like_count %s DEFAULT 0,
                sort_order %s DEFAULT 0,
                is_active %s DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.formatted(id, bigInt, varchar32, varchar64, varchar64, text, integer, integer, integer));

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
        String varchar191 = isMysql() ? "VARCHAR(191)" : "TEXT";
        String text = "TEXT";

        migrateColumns("users", List.of(
            "is_active " + integer + " DEFAULT 1",
            "binding_code " + varchar32,
            "wechat_openid " + varchar191,
            "wechat_unionid " + varchar191,
            "wechat_nickname " + text,
            "wechat_avatar " + text,
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
        migrateColumns("mental_screenings", List.of(
            "family_id " + varchar64,
            "elderly_id " + bigInt,
            "capture_mode " + varchar64 + " DEFAULT 'live_camera'",
            "risk_level " + varchar32,
            "risk_score " + integer + " DEFAULT 0",
            "status_label " + text,
            "summary " + text,
            "recommendation " + text,
            "frame_path " + text,
            "frame_count " + integer + " DEFAULT 0",
            "completed_actions " + integer + " DEFAULT 0",
            "liveness_score " + integer + " DEFAULT 0",
            "quality_score " + integer + " DEFAULT 0",
            "consent_version " + varchar64,
            "source " + varchar64 + " DEFAULT 'elderly'",
            "is_active " + integer + " DEFAULT 1",
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("counselors", List.of(
            "experience " + text,
            "specialty " + text,
            "rating " + text,
            "avatar " + text,
            "price " + integer + " DEFAULT 300",
            "discount_price " + integer + " DEFAULT 210",
            "education " + text,
            "tags " + text,
            "experience_stats " + text,
            "availability_text " + text,
            "format_text " + text,
            "location " + text,
            "specialties " + text,
            "packages " + text,
            "calendar " + text,
            "notices " + text,
            "hero_emoji " + text,
            "hero_hint " + text,
            "brand_text " + text,
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
        migrateColumns("psychology_videos", List.of(
            "slug " + varchar191,
            "title " + text,
            "category " + text,
            "duration " + varchar64,
            "speaker " + text,
            "summary " + text,
            "poster_url " + text,
            "source_url " + text,
            "license " + text,
            "cover_class_name " + varchar64,
            "takeaways " + text,
            "sort_order " + integer + " DEFAULT 0",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("psychology_categories", List.of(
            "name " + text,
            "icon " + varchar64,
            "class_name " + varchar64,
            "sort_order " + integer + " DEFAULT 0",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("psychology_questions", List.of(
            "question " + text,
            "sort_order " + integer + " DEFAULT 0",
            "is_active " + integer + " DEFAULT 1",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ));
        migrateColumns("psychology_question_replies", List.of(
            "question_id " + bigInt,
            "reply_type " + varchar32,
            "author_name " + varchar64,
            "author_role " + varchar64,
            "content " + text,
            "like_count " + integer + " DEFAULT 0",
            "sort_order " + integer + " DEFAULT 0",
            "is_active " + integer + " DEFAULT 1",
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
        safeUpdate("UPDATE mental_screenings SET capture_mode = 'live_camera' WHERE capture_mode IS NULL OR capture_mode = ''");
        safeUpdate("UPDATE mental_screenings SET source = 'elderly' WHERE source IS NULL OR source = ''");
        safeUpdate("UPDATE mental_screenings SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE counselors SET available = 1 WHERE available IS NULL");
        safeUpdate("UPDATE counselors SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE counselors SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE consultations SET consultation_type = 'phone' WHERE consultation_type IS NULL OR consultation_type = ''");
        safeUpdate("UPDATE consultations SET duration = 45 WHERE duration IS NULL");
        safeUpdate("UPDATE consultations SET status = 'scheduled' WHERE status IS NULL OR status = ''");
        safeUpdate("UPDATE consultations SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE psychology_videos SET sort_order = id WHERE sort_order IS NULL");
        safeUpdate("UPDATE psychology_videos SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE psychology_videos SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE psychology_categories SET sort_order = id WHERE sort_order IS NULL");
        safeUpdate("UPDATE psychology_categories SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE psychology_categories SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE psychology_questions SET sort_order = id WHERE sort_order IS NULL");
        safeUpdate("UPDATE psychology_questions SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE psychology_questions SET updated_at = created_at WHERE updated_at IS NULL");
        safeUpdate("UPDATE psychology_question_replies SET sort_order = id WHERE sort_order IS NULL");
        safeUpdate("UPDATE psychology_question_replies SET is_active = 1 WHERE is_active IS NULL");
        safeUpdate("UPDATE psychology_question_replies SET like_count = 0 WHERE like_count IS NULL");
        safeUpdate("UPDATE psychology_question_replies SET updated_at = created_at WHERE updated_at IS NULL");
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

    private void seedCounselors() {
        seedCounselor(
            1,
            "徐媛",
            "国家三级咨询师",
            "3年5月",
            "个人成长、情绪管理、人际关系",
            "4.9",
            "👩‍⚕️",
            300,
            210,
            "心理学硕士",
            List.of("85后", "LGBTQ友好咨询师", "体制内工作经验"),
            map("hours", "500+", "years", "3年5月", "training", "7段", "supervision", "113小时"),
            "最快可约最近6天",
            "视频/面对面",
            "江苏省南京市鼓...",
            List.of(
                map("title", "个人成长", "items", List.of("自我探索", "女性成长", "个人发展", "自我价值", "内心冲突")),
                map("title", "情绪管理", "items", List.of("焦虑", "抑郁", "无价值感", "无意义感", "孤独")),
                map("title", "人际关系", "items", List.of())
            ),
            List.of(
                map("id", 1, "name", "单次咨询", "price", 300, "description", "擅长个人成长、情绪管理、人际关系"),
                map("id", 2, "name", "3次主题咨询套餐", "price", 210, "label", "初始访谈", "description", "初始访谈")
            ),
            defaultCounselorCalendar(),
            defaultCounselorNotices(),
            "你一起慢慢来",
            "壹心理专家会监管护航 15年品牌·70%+硕博师资·隐私专利",
            1
        );
        seedCounselor(
            2,
            "李心怡",
            "资深心理咨询师",
            "12年",
            "老年心理、情绪疏导、家庭沟通",
            "4.8",
            "👩‍💼",
            360,
            260,
            "应用心理学硕士",
            List.of("70后", "适老心理支持", "长期照护经验"),
            map("hours", "1200+", "years", "12年", "training", "11段", "supervision", "260小时"),
            "最快可约最近3天",
            "视频/电话",
            "上海市徐汇区",
            List.of(
                map("title", "老年心理", "items", List.of("退休适应", "孤独感", "生活意义", "慢病心理", "空巢适应")),
                map("title", "情绪疏导", "items", List.of("焦虑", "抑郁情绪", "睡眠压力", "无助感", "情绪低落")),
                map("title", "家庭沟通", "items", List.of("代际沟通", "照护冲突", "陪伴支持", "需求表达", "家庭边界"))
            ),
            List.of(
                map("id", 1, "name", "单次咨询", "price", 360, "description", "适合近期情绪波动、睡眠压力和孤独感支持"),
                map("id", 2, "name", "3次主题咨询套餐", "price", 260, "label", "初始访谈", "description", "围绕家庭沟通和长期陪伴建立稳定支持")
            ),
            defaultCounselorCalendar(),
            defaultCounselorNotices(),
            "慢一点，也能走得稳",
            "平台专家督导护航·适老咨询经验丰富·隐私全程保护",
            1
        );
        seedCounselor(
            3,
            "王建国",
            "心理治疗师",
            "8年",
            "睡眠问题、焦虑调节、认知行为",
            "4.5",
            "👨‍⚕️",
            320,
            238,
            "临床心理学硕士",
            List.of("75后", "CBT取向", "睡眠改善计划"),
            map("hours", "820+", "years", "8年", "training", "9段", "supervision", "180小时"),
            "最快可约最近4天",
            "视频/电话",
            "北京市海淀区",
            List.of(
                map("title", "睡眠问题", "items", List.of("入睡困难", "早醒", "睡前焦虑", "作息重建", "睡眠节律")),
                map("title", "焦虑调节", "items", List.of("健康焦虑", "反复担心", "躯体化不适", "放松训练", "惊恐体验")),
                map("title", "认知行为", "items", List.of("自动化思维", "行为激活", "情绪记录", "问题解决", "压力复盘"))
            ),
            List.of(
                map("id", 1, "name", "单次咨询", "price", 320, "description", "梳理睡眠困扰并制定一周改善计划"),
                map("id", 2, "name", "3次主题咨询套餐", "price", 238, "label", "初始访谈", "description", "通过认知行为练习逐步降低焦虑水平")
            ),
            defaultCounselorCalendar(),
            defaultCounselorNotices(),
            "先睡好，再慢慢变好",
            "睡眠与焦虑专向支持·咨询记录可追踪·家属协同更安心",
            1
        );
        seedCounselor(
            4,
            "张婷婷",
            "临床心理医生",
            "15年",
            "慢性病心理、健康焦虑、情绪支持",
            "4.9",
            "👩‍⚕️",
            420,
            320,
            "医学心理学博士",
            List.of("80后", "临床医学背景", "慢病心理专长"),
            map("hours", "1800+", "years", "15年", "training", "14段", "supervision", "360小时"),
            "最快可约最近8天",
            "视频/面对面",
            "浙江省杭州市",
            List.of(
                map("title", "慢性病心理", "items", List.of("疾病适应", "服药压力", "康复动机", "长期照护", "复诊焦虑")),
                map("title", "健康焦虑", "items", List.of("过度担心", "反复检查", "躯体敏感", "风险沟通", "检查等待")),
                map("title", "情绪支持", "items", List.of("无助感", "低落", "家庭支持", "危机识别", "照护压力"))
            ),
            List.of(
                map("id", 1, "name", "单次咨询", "price", 420, "description", "适合慢病照护中的焦虑和压力管理"),
                map("id", 2, "name", "3次主题咨询套餐", "price", 320, "label", "初始访谈", "description", "结合疾病管理与心理调适持续跟进")
            ),
            defaultCounselorCalendar(),
            defaultCounselorNotices(),
            "疾病之外，仍然有生活",
            "临床心理医生把关·慢病心理专向·服务端可持续跟进",
            1
        );
        seedCounselor(
            5,
            "刘明辉",
            "家庭治疗师",
            "10年",
            "家庭关系、代际沟通、照护支持",
            "4.7",
            "👨‍💼",
            350,
            260,
            "婚姻家庭治疗硕士",
            List.of("75后", "家庭治疗取向", "家属协同咨询"),
            map("hours", "1000+", "years", "10年", "training", "10段", "supervision", "220小时"),
            "最快可约最近5天",
            "视频/电话",
            "广东省深圳市",
            List.of(
                map("title", "家庭关系", "items", List.of("亲子沟通", "伴侣协作", "边界感", "照护分工", "角色变化")),
                map("title", "代际沟通", "items", List.of("观念冲突", "情绪表达", "需求协商", "家庭会议", "冲突修复")),
                map("title", "照护支持", "items", List.of("家属压力", "内疚感", "长期陪护", "资源协调", "照护倦怠"))
            ),
            List.of(
                map("id", 1, "name", "单次咨询", "price", 350, "description", "适合家庭照护冲突和代际沟通问题"),
                map("id", 2, "name", "3次主题咨询套餐", "price", 260, "label", "初始访谈", "description", "帮助家庭成员建立更清晰的照护协作方式")
            ),
            defaultCounselorCalendar(),
            defaultCounselorNotices(),
            "把话说开，把心放近",
            "家庭治疗取向·支持家属共同参与·照护协作更清晰",
            1
        );
    }

    private Map<String, Object> defaultCounselorCalendar() {
        return map(
            "month", "2026年5月",
            "dates", List.of(
                map("day", 26, "status", "full"),
                map("day", 27, "status", "full"),
                map("day", 28, "status", "full"),
                map("day", 29, "status", "full"),
                map("day", 30, "status", "full"),
                map("day", "今天", "status", "full", "isToday", true),
                map("day", 2, "status", "full"),
                map("day", 3, "status", "full"),
                map("day", 4, "status", "full"),
                map("day", 5, "status", "full"),
                map("day", 6, "status", "full"),
                map("day", 7, "available", 3),
                map("day", 8, "status", "full"),
                map("day", 9, "status", "full"),
                map("day", 10, "status", "full"),
                map("day", 11, "available", 5),
                map("day", 12, "available", 1),
                map("day", 13, "status", "full"),
                map("day", 14, "available", 5),
                map("day", 15, "available", 4),
                map("day", 16, "available", 4)
            )
        );
    }

    private List<Map<String, Object>> defaultCounselorNotices() {
        return List.of(
            map("title", "回应时长", "text", "我将在收到订单后6小时内回复是否接受咨询，且在12小时内通过私信/电话与来访者协商咨询时间、地点。"),
            map("title", "变更预约说明", "text", "若需要变更/取消已协商好的咨询预约，请务必提前24小时联络我。否则咨询将如期开始并正常计费。"),
            map("title", "爽约/迟到说明", "text", "若没有提前24小时告知情况，爽约/迟到20分钟以上，则默认这次咨询已经完成。其他特殊情况，需与我协商处理。")
        );
    }

    private void seedCounselor(long id,
                               String name,
                               String title,
                               String experience,
                               String specialty,
                               String rating,
                               String avatar,
                               int price,
                               int discountPrice,
                               String education,
                               List<String> tags,
                               Map<String, Object> experienceStats,
                               String availabilityText,
                               String formatText,
                               String location,
                               List<Map<String, Object>> specialties,
                               List<Map<String, Object>> packages,
                               Map<String, Object> calendar,
                               List<Map<String, Object>> notices,
                               String heroHint,
                               String brandText,
                               int available) {
        Object[] values = new Object[] {
            name, title, experience, specialty, rating, avatar, price, discountPrice, education,
            toJson(tags), toJson(experienceStats), availabilityText, formatText, location,
            toJson(specialties), toJson(packages), toJson(calendar), toJson(notices),
            avatar, heroHint, brandText, available, id
        };
        int updated = jdbc.update("""
            UPDATE counselors
            SET name = ?, title = ?, experience = ?, specialty = ?, rating = ?, avatar = ?,
                price = ?, discount_price = ?, education = ?, tags = ?, experience_stats = ?,
                availability_text = ?, format_text = ?, location = ?, specialties = ?, packages = ?,
                calendar = ?, notices = ?, hero_emoji = ?, hero_hint = ?, brand_text = ?,
                available = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, values);
        if (updated > 0) {
            return;
        }
        jdbc.update("""
            INSERT INTO counselors (
                id, name, title, experience, specialty, rating, avatar, price, discount_price,
                education, tags, experience_stats, availability_text, format_text, location,
                specialties, packages, calendar, notices, hero_emoji, hero_hint, brand_text,
                available, is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            id, name, title, experience, specialty, rating, avatar, price, discountPrice, education,
            toJson(tags), toJson(experienceStats), availabilityText, formatText, location,
            toJson(specialties), toJson(packages), toJson(calendar), toJson(notices),
            avatar, heroHint, brandText, available);
    }

    private void createIndexes() {
        createIndex("idx_users_family_active", "users", "family_id, is_active, user_type");
        createIndex("idx_users_binding_code", "users", "binding_code");
        createIndex("idx_users_wechat_openid", "users", "wechat_openid");
        createIndex("idx_mood_records_family_id", "mood_records", "family_id");
        createIndex("idx_mood_records_elderly_id", "mood_records", "elderly_id");
        createIndex("idx_mood_records_recorded_at", "mood_records", "recorded_at DESC");
        createIndex("idx_mental_screenings_family_created", "mental_screenings", "family_id, created_at DESC");
        createIndex("idx_mental_screenings_elderly_created", "mental_screenings", "elderly_id, created_at DESC");
        createIndex("idx_family_alerts_family_id", "family_alerts", "family_id");
        createIndex("idx_family_alerts_created_at", "family_alerts", "created_at DESC");
        createIndex("idx_family_alerts_handled", "family_alerts", "handled, created_at DESC");
        createIndex("idx_care_audit_family_created", "care_audit_logs", "family_id, created_at DESC");
        createIndex("idx_care_audit_elderly_created", "care_audit_logs", "elderly_id, created_at DESC");
        createIndex("idx_psychology_videos_active_sort", "psychology_videos", "is_active, sort_order, id");
        createIndex("idx_psychology_categories_active_sort", "psychology_categories", "is_active, sort_order, id");
        createIndex("idx_psychology_questions_active_sort", "psychology_questions", "is_active, sort_order, id");
        createIndex("idx_psychology_question_replies_question", "psychology_question_replies", "question_id, is_active, sort_order, id");
    }

    private void createIndex(String name, String table, String columns) {
        try {
            String exists = isMysql() ? "" : "IF NOT EXISTS ";
            jdbc.execute("CREATE INDEX " + exists + name + " ON " + table + "(" + columns + ")");
        } catch (Exception ignored) {
        }
    }

}
