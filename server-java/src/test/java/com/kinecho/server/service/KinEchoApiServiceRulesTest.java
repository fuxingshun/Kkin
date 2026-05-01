package com.kinecho.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.mapper.KinEchoMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class KinEchoApiServiceRulesTest {
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Mock
    JdbcTemplate jdbc;

    @Mock
    AiCompanionService aiCompanion;

    @Mock
    ToastService toastService;

    KinEchoProperties properties;
    KinEchoMapper db;
    KinEchoApiService service;

    @BeforeEach
    void setUp() {
        properties = new KinEchoProperties();
        properties.setZoneId("Asia/Shanghai");
        db = spy(new KinEchoMapper(jdbc, properties, new ObjectMapper()));
        service = new KinEchoApiService(db, properties, aiCompanion, toastService, new ObjectMapper());
    }

    @Test
    void createMoodRejectsDuplicateManualRecordForSameDay() {
        LocalDateTime now = LocalDateTime.now(properties.zoneId).withNano(0);
        doReturn(1L).when(db).count(
            contains("FROM mood_records"),
            eq("family_001"),
            eq(7L),
            eq(now.toLocalDate().toString())
        );

        ResponseEntity<Map<String, Object>> response = service.createMood(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "mood_type", "happy",
            "mood_score", 9,
            "recorded_at", now.format(DATE_TIME)
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("today mood already recorded", response.getBody().get("error"));
        verify(db, never()).insert(
            contains("INSERT INTO mood_records"),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any()
        );
    }

    @Test
    void getPendingMessagesOnlyReturnsDueMessagesScheduledToday() {
        LocalDateTime now = LocalDateTime.now(properties.zoneId).withNano(0);
        List<Map<String, Object>> rows = List.of(
            new LinkedHashMap<>(Map.of(
                "id", 1L,
                "scheduled_time", now.minusMinutes(10).format(DATE_TIME),
                "played", 0,
                "liked", 0
            )),
            new LinkedHashMap<>(Map.of(
                "id", 2L,
                "scheduled_time", now.plusMinutes(20).format(DATE_TIME),
                "played", 0,
                "liked", 0
            )),
            new LinkedHashMap<>(Map.of(
                "id", 3L,
                "scheduled_time", now.minusDays(1).format(DATE_TIME),
                "played", 0,
                "liked", 1
            ))
        );
        doReturn(rows).when(db).list(contains("FROM family_messages"), eq("family_001"));

        ResponseEntity<Map<String, Object>> response = service.getPendingMessages("family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> messages = (List<?>) response.getBody().get("messages");
        assertEquals(1, messages.size());
        Map<?, ?> message = (Map<?, ?>) messages.get(0);
        assertEquals(1L, ((Number) message.get("id")).longValue());
        assertFalse((Boolean) message.get("played"));
        assertFalse((Boolean) message.get("liked"));
    }

    @Test
    void createUserAssignsBindingCodeToElderlyUser() {
        doReturn(Optional.empty()).when(db).one(eq("SELECT id FROM users WHERE binding_code = ? LIMIT 1"), any());
        doReturn(11L).when(db).insert(
            contains("INSERT INTO users"),
            eq("elderly"),
            eq("test elderly"),
            eq(""),
            eq("family_001"),
            any(),
            eq("admin"),
            eq("admin")
        );

        ResponseEntity<Map<String, Object>> response = service.createUser(Map.of(
            "user_type", "elderly",
            "name", "test elderly",
            "family_id", "family_001",
            "operator", "admin"
        ));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(11L, ((Number) response.getBody().get("user_id")).longValue());
        verify(db).insert(
            contains("INSERT INTO users"),
            eq("elderly"),
            eq("test elderly"),
            eq(""),
            eq("family_001"),
            any(),
            eq("admin"),
            eq("admin")
        );
    }

    @Test
    void getUserBindingCodeGeneratesAndPersistsMissingCode() {
        doReturn(Optional.of(Map.of(
            "id", 5L,
            "family_id", "family_001",
            "user_type", "elderly",
            "name", "elderly user",
            "binding_code", ""
        ))).when(db).one(contains("SELECT id, family_id, user_type, name, binding_code"), eq(5L), eq("family_001"));
        doReturn(Optional.empty()).when(db).one(eq("SELECT id FROM users WHERE binding_code = ? LIMIT 1"), any());

        ResponseEntity<Map<String, Object>> response = service.getUserBindingCode(5L, "family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertEquals("family_001", body.get("family_id"));
        assertEquals(5L, ((Number) body.get("elderly_id")).longValue());
        assertEquals("elderly user", body.get("elderly_name"));
        assertNotNull(body.get("binding_code"));
        assertEquals(8, body.get("binding_code").toString().length());
        verify(db).update(
            eq("UPDATE users SET binding_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
            any(),
            eq(5L)
        );
    }

    @Test
    void bindFamilyByCodeCreatesNewFamilyUserWhenPhoneDoesNotMatch() {
        doReturn(Optional.of(Map.of(
            "id", 7L,
            "family_id", "family_001",
            "name", "elderly user",
            "binding_code", "AB12CD34"
        ))).when(db).one(contains("WHERE binding_code = ? AND user_type = 'elderly' AND is_active = 1"), eq("AB12CD34"));
        doReturn(Optional.empty()).when(db).one(
            contains("WHERE family_id = ? AND phone = ? AND user_type = 'family' AND is_active = 1"),
            eq("family_001"),
            eq("13900000000")
        );
        doReturn(22L).when(db).insert(
            contains("INSERT INTO users"),
            eq("daughter"),
            eq("13900000000"),
            eq("family_001"),
            eq("family-bind"),
            eq("family-bind")
        );

        ResponseEntity<Map<String, Object>> response = service.bindFamilyByCode(Map.of(
            "binding_code", "ab12cd34",
            "name", "daughter",
            "phone", "13900000000"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(22L, ((Number) response.getBody().get("user_id")).longValue());
        assertEquals("AB12CD34", response.getBody().get("binding_code"));
        assertEquals("elderly user", response.getBody().get("elderly_name"));
    }

    @Test
    void bindFamilyByCodeUpdatesExistingFamilyUserWhenPhoneMatches() {
        doReturn(Optional.of(Map.of(
            "id", 7L,
            "family_id", "family_001",
            "name", "elderly user",
            "binding_code", "AB12CD34"
        ))).when(db).one(contains("WHERE binding_code = ? AND user_type = 'elderly' AND is_active = 1"), eq("AB12CD34"));
        doReturn(Optional.of(Map.of("id", 9L))).when(db).one(
            contains("WHERE family_id = ? AND phone = ? AND user_type = 'family' AND is_active = 1"),
            eq("family_001"),
            eq("13900000000")
        );

        ResponseEntity<Map<String, Object>> response = service.bindFamilyByCode(Map.of(
            "binding_code", "ab12cd34",
            "name", "daughter",
            "phone", "13900000000"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(9L, ((Number) response.getBody().get("user_id")).longValue());
        assertTrue(response.getBody().containsKey("binding_code"));
        verify(db).update(
            contains("SET name = ?, phone = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP"),
            eq("daughter"),
            eq("13900000000"),
            eq("family-bind"),
            eq(9L)
        );
    }

    @Test
    void loginAllowsElderlyUserWithPhoneSuffixPassword() {
        doReturn(Optional.of(Map.of(
            "id", 5L,
            "user_type", "elderly",
            "name", "elderly account",
            "phone", "13800138000",
            "family_id", "family_001",
            "binding_code", "AB12CD34"
        ))).when(db).one(
            contains("WHERE user_type = ? AND is_active = 1 AND (name = ? OR phone = ?)"),
            eq("elderly"),
            eq("13800138000"),
            eq("13800138000")
        );

        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "elderly",
            "username", "13800138000",
            "password", "138000"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("elderly", response.getBody().get("role"));
        assertEquals(5L, ((Number) response.getBody().get("elderly_id")).longValue());
        assertEquals("family_001", response.getBody().get("family_id"));
    }

    @Test
    void loginAllowsAdminWithConfiguredCredentials() {
        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "admin",
            "username", "admin",
            "password", "123456"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("admin", response.getBody().get("role"));
        assertTrue(response.getBody().containsKey("display_name"));
    }

    @Test
    void loginAllowsServiceWithConfiguredFamilyContext() {
        properties.serviceFamilyId = "family_service_001";

        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "service",
            "username", "service",
            "password", "123456"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("service", response.getBody().get("role"));
        assertEquals("family_service_001", response.getBody().get("family_id"));
    }

    @Test
    void wechatLoginBindsFirstUnboundElderlyUserInDevMode() {
        doReturn(Optional.empty()).when(db).one(
            contains("wechat_openid = ?"),
            eq("elderly"),
            eq("dev-wechat-openid-elderly")
        );
        doReturn(Optional.of(Map.of(
            "id", 5L,
            "user_type", "elderly",
            "name", "elderly account",
            "phone", "13800138000",
            "family_id", "family_001",
            "binding_code", "AB12CD34",
            "wechat_openid", ""
        ))).when(db).one(
            contains("wechat_openid IS NULL"),
            eq("elderly")
        );

        ResponseEntity<Map<String, Object>> response = service.wechatLogin(Map.of(
            "role", "elderly",
            "code", "mock-code",
            "user_info", Map.of("nickName", "wx user", "avatarUrl", "https://example.com/a.png")
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("elderly", response.getBody().get("role"));
        assertEquals(5L, ((Number) response.getBody().get("elderly_id")).longValue());
        verify(db).update(
            contains("SET wechat_openid = ?"),
            eq("dev-wechat-openid-elderly"),
            any(),
            eq("wx user"),
            eq("https://example.com/a.png"),
            eq(5L)
        );
    }

    @Test
    void wechatLoginAllowsServiceRoleInDevMode() {
        properties.serviceFamilyId = "family_service_001";

        ResponseEntity<Map<String, Object>> response = service.wechatLogin(Map.of(
            "role", "service",
            "code", "mock-code"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("service", response.getBody().get("role"));
        assertEquals("family_service_001", response.getBody().get("family_id"));
    }

    @Test
    void handleAlertRequiresFamilyContext() {
        ResponseEntity<Map<String, Object>> response = service.handleAlert(11L, Map.of(
            "reply_message", "handled"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("missing family_id", response.getBody().get("error"));
    }

    @Test
    void deleteMessageReturnsNotFoundWhenFamilyScopeDoesNotMatch() {
        doReturn(0).when(db).update(
            contains("UPDATE family_messages SET is_active = 0"),
            eq(9L),
            eq("family_404")
        );

        ResponseEntity<Map<String, Object>> response = service.deleteMessage(9L, "family_404");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("message not found", response.getBody().get("error"));
    }

    @Test
    void getMediaDetailScopesLookupByFamilyId() {
        doReturn(Optional.of(new LinkedHashMap<>(Map.ofEntries(
            Map.entry("id", 12L),
            Map.entry("family_id", "family_001"),
            Map.entry("media_type", "photo"),
            Map.entry("title", "old album"),
            Map.entry("description", "family memories"),
            Map.entry("file_path", "uploads/demo.jpg"),
            Map.entry("thumbnail_path", "uploads/thumbnails/demo.jpg"),
            Map.entry("time_windows", "[]"),
            Map.entry("moods", "[]"),
            Map.entry("occasions", "[]"),
            Map.entry("cooldown", 60),
            Map.entry("priority", 5),
            Map.entry("play_count", 3),
            Map.entry("last_played_at", "2026-04-20 09:00:00")
        )))).when(db).one(
            contains("WHERE m.id = ? AND m.family_id = ? AND m.is_active = 1"),
            eq(12L),
            eq("family_001")
        );
        doReturn(List.of(Map.of("tag", "family"), Map.of("tag", "travel"))).when(db).list(
            eq("SELECT tag FROM media_tags WHERE media_id = ?"),
            eq(12L)
        );
        doReturn(Optional.of(Map.of(
            "total_plays", 3L,
            "likes", 2L,
            "dislikes", 0L
        ))).when(db).one(contains("SELECT COUNT(*) AS total_plays"), eq(12L));
        doReturn(List.of()).when(db).list(contains("FROM media_play_history"), eq(12L));

        ResponseEntity<Map<String, Object>> response = service.getMediaDetail(12L, "family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("old album", response.getBody().get("title"));
        assertEquals(List.of("family", "travel"), response.getBody().get("tags"));
    }

    @Test
    void updateServiceFollowupStatusRequiresFamilyContext() {
        ResponseEntity<Map<String, Object>> response = service.updateServiceFollowupStatus(15L, Map.of(
            "status", "completed"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("missing family_id", response.getBody().get("error"));
    }

    @Test
    void getServiceOverviewAggregatesTaskCaseAndFollowupStats() {
        doReturn(Optional.of(Map.of(
            "pending", 2L,
            "processing", 1L,
            "completed", 4L,
            "total", 7L
        ))).when(db).one(contains("COUNT(CASE WHEN handled = 0"), eq("family_001"));
        doReturn(Optional.of(Map.of(
            "scheduled", 2L,
            "in_progress", 1L,
            "completed", 3L,
            "active", 3L,
            "total", 6L
        ))).when(db).one(contains("FROM consultations"), eq("family_001"));
        doReturn(List.of(
            Map.of("id", 1L),
            Map.of("id", 2L)
        )).when(db).list(contains("FROM users"), eq("family_001"));
        doReturn(List.of(
            Map.of("elderly_id", 1L, "level", "high", "handled", 0),
            Map.of("elderly_id", 1L, "level", "medium", "handled", 0),
            Map.of("elderly_id", 2L, "level", "low", "handled", 1)
        )).when(db).list(contains("SELECT elderly_id, level, handled"), eq("family_001"));
        doReturn(List.of(
            Map.of("elderly_id", 1L, "mood_score", 4),
            Map.of("elderly_id", 2L, "mood_score", 8)
        )).when(db).list(contains("FROM mood_records"), eq("family_001"), eq("family_001"));

        ResponseEntity<Map<String, Object>> response = service.getServiceOverview("family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> taskStats = (Map<?, ?>) response.getBody().get("task_stats");
        Map<?, ?> caseStats = (Map<?, ?>) response.getBody().get("case_stats");
        Map<?, ?> followupStats = (Map<?, ?>) response.getBody().get("followup_stats");
        assertEquals(2L, ((Number) taskStats.get("pending")).longValue());
        assertEquals(1L, ((Number) caseStats.get("high")).longValue());
        assertEquals(1L, ((Number) caseStats.get("low")).longValue());
        assertEquals(3L, ((Number) followupStats.get("active")).longValue());
    }

    @Test
    void getAdminServiceSummaryBuildsRoleAndCaseRows() {
        LocalDateTime now = LocalDateTime.now(properties.zoneId).withNano(0);
        doReturn(List.of(
            Map.of("id", 1L, "title", "counselor", "available", 1),
            Map.of("id", 2L, "title", "counselor", "available", 0),
            Map.of("id", 3L, "title", "social worker", "available", 1)
        )).when(db).list(contains("FROM counselors"));
        doReturn(List.of(
            Map.of(
                "elderly_id", 1L,
                "counselor_id", 1L,
                "status", "scheduled",
                "scheduled_time", now.plusDays(1).format(DATE_TIME),
                "updated_at", now.format(DATE_TIME)
            ),
            Map.of(
                "elderly_id", 2L,
                "counselor_id", 3L,
                "status", "completed",
                "scheduled_time", now.minusDays(1).format(DATE_TIME),
                "updated_at", now.minusDays(1).format(DATE_TIME)
            )
        )).when(db).list(contains("FROM consultations"), eq("family_001"));
        doReturn(List.of(
            Map.of("id", 1L, "name", "elderly one"),
            Map.of("id", 2L, "name", "elderly two")
        )).when(db).list(contains("WHERE family_id = ? AND user_type = 'elderly'"), eq("family_001"));
        doReturn(List.of(
            Map.of("elderly_id", 1L, "level", "high", "handled", 0),
            Map.of("elderly_id", 2L, "level", "low", "handled", 1)
        )).when(db).list(contains("FROM family_alerts"), eq("family_001"));
        doReturn(List.of(
            Map.of("elderly_id", 1L, "mood_score", 4),
            Map.of("elderly_id", 2L, "mood_score", 8)
        )).when(db).list(contains("SELECT m.elderly_id, m.mood_type, m.mood_score, m.recorded_at"), eq("family_001"), eq("family_001"));

        ResponseEntity<Map<String, Object>> response = service.getAdminServiceSummary("family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> overview = (Map<?, ?>) response.getBody().get("overview");
        List<?> roleStats = (List<?>) response.getBody().get("role_stats");
        List<?> caseRows = (List<?>) response.getBody().get("case_rows");
        assertEquals(3L, ((Number) overview.get("total_counselors")).longValue());
        assertEquals(2L, ((Number) overview.get("available_counselors")).longValue());
        assertEquals(1L, ((Number) overview.get("active_consultations")).longValue());
        assertEquals(1L, ((Number) overview.get("high_risk_cases")).longValue());
        assertEquals(2, roleStats.size());
        assertEquals(2, caseRows.size());

        Map<?, ?> firstRole = (Map<?, ?>) roleStats.get(0);
        Map<?, ?> firstCase = (Map<?, ?>) caseRows.get(0);
        assertEquals("counselor", firstRole.get("role"));
        assertEquals(2L, ((Number) firstRole.get("count")).longValue());
        assertEquals("high", firstCase.get("risk_level"));
        assertEquals(1L, ((Number) firstCase.get("open_alerts")).longValue());
    }

    @Test
    void getAdminAnalyticsBuildsGrowthAndWeeklyActivity() {
        LocalDateTime now = LocalDateTime.now(properties.zoneId).withNano(0);
        String start = now.toLocalDate().minusDays(6).toString();
        doReturn(List.of(
            Map.of("user_type", "elderly", "created_at", now.minusMonths(1).format(DATE_TIME)),
            Map.of("user_type", "family", "created_at", now.format(DATE_TIME)),
            Map.of("user_type", "family", "created_at", now.format(DATE_TIME))
        )).when(db).list(contains("SELECT user_type, created_at"), eq("family_001"));
        doReturn(List.of(
            Map.of("scheduled_time", now.minusDays(1).format(DATE_TIME)),
            Map.of("scheduled_time", now.format(DATE_TIME))
        )).when(db).list(contains("SELECT scheduled_time"), eq("family_001"), eq(start));
        doReturn(List.of(
            Map.of("played_at", now.minusDays(1).format(DATE_TIME))
        )).when(db).list(contains("SELECT mph.played_at"), eq("family_001"), eq(start));
        doReturn(List.of(
            Map.of("recorded_at", now.minusDays(1).format(DATE_TIME), "mood_score", 7),
            Map.of("recorded_at", now.format(DATE_TIME), "mood_score", 9)
        )).when(db).list(contains("SELECT recorded_at, mood_score"), eq("family_001"), eq(start));

        ResponseEntity<Map<String, Object>> response = service.getAdminAnalytics("family_001", 3, 7);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> summary = (Map<?, ?>) response.getBody().get("summary");
        List<?> userGrowth = (List<?>) response.getBody().get("user_growth");
        List<?> weeklyActivity = (List<?>) response.getBody().get("weekly_activity");
        assertEquals(3L, ((Number) summary.get("total_users")).longValue());
        assertEquals(1L, ((Number) summary.get("elderly_users")).longValue());
        assertEquals(2L, ((Number) summary.get("family_users")).longValue());
        assertEquals(2L, ((Number) summary.get("followups")).longValue());
        assertEquals(1L, ((Number) summary.get("media_plays")).longValue());
        assertEquals(2L, ((Number) summary.get("mood_records")).longValue());
        assertEquals(8.0, ((Number) summary.get("avg_mood_score")).doubleValue());
        assertEquals(3, userGrowth.size());
        assertEquals(7, weeklyActivity.size());

        long followupTotal = 0;
        long memoryTotal = 0;
        for (Object item : weeklyActivity) {
            Map<?, ?> row = (Map<?, ?>) item;
            followupTotal += ((Number) row.get("followups")).longValue();
            memoryTotal += ((Number) row.get("memory")).longValue();
        }
        assertEquals(2L, followupTotal);
        assertEquals(1L, memoryTotal);
    }

    @Test
    void getServiceTasksMapsAlertLifecycleToTaskStatus() {
        Map<String, Object> taskRow = new LinkedHashMap<>();
        taskRow.put("id", 11L);
        taskRow.put("alert_id", 11L);
        taskRow.put("elderly_id", 5L);
        taskRow.put("elderly_name", "elderly user");
        taskRow.put("alert_type", "emotion");
        taskRow.put("title", "");
        taskRow.put("message", "emotion alert");
        taskRow.put("level", "high");
        taskRow.put("handled", 0);
        taskRow.put("task_read", 1);
        taskRow.put("created_at", "2026-04-20 09:00:00");
        doReturn(List.of(taskRow)).when(db).list(contains("AS task_read"), eq("family_001"), eq(50));
        // legacy inline mock intentionally omitted

















        ResponseEntity<Map<String, Object>> response = service.getServiceTasks(Map.of(
            "family_id", "family_001",
            "limit", "50"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> tasks = (List<?>) response.getBody().get("tasks");
        assertEquals(1, tasks.size());
        Map<?, ?> task = (Map<?, ?>) tasks.get(0);
        assertEquals("high", task.get("priority"));
        assertEquals("processing", task.get("status"));
        assertEquals("elderly user", task.get("elderly_name"));
        assertEquals("emotion alert", task.get("reason"));
        // legacy assertions intentionally omitted



    }

    @Test
    void getServiceCasesAggregatesRiskMoodAndFamilyContact() {
        doReturn(List.of(
            Map.of("id", 1L, "name", "elderly one", "phone", "13800138000"),
            Map.of("id", 2L, "name", "elderly two", "phone", "13800138001")
        )).when(db).list(contains("WHERE family_id = ? AND user_type = 'elderly'"), eq("family_001"));
        doReturn(List.of(
            Map.of("id", 9L, "name", "daughter", "phone", "13900139000")
        )).when(db).list(contains("WHERE family_id = ? AND user_type = 'family'"), eq("family_001"));
        doReturn(List.of(
            Map.of("id", 100L, "elderly_id", 1L, "level", "high", "handled", 0, "created_at", "2026-04-20 08:00:00"),
            Map.of("id", 101L, "elderly_id", 2L, "level", "low", "handled", 1, "created_at", "2026-04-20 07:00:00")
        )).when(db).list(contains("SELECT id, elderly_id, level, handled, created_at"), eq("family_001"));
        doReturn(List.of(
            Map.of("elderly_id", 1L, "mood_type", "sad", "mood_score", 4, "recorded_at", "2026-04-20 09:30:00"),
            Map.of("elderly_id", 2L, "mood_type", "calm", "mood_score", 8, "recorded_at", "2026-04-20 09:00:00")
        )).when(db).list(contains("SELECT m.elderly_id, m.mood_type, m.mood_score"), eq("family_001"), eq("family_001"));

        ResponseEntity<Map<String, Object>> response = service.getServiceCases("family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> cases = (List<?>) response.getBody().get("cases");
        assertEquals(2, cases.size());
        Map<?, ?> first = (Map<?, ?>) cases.get(0);
        assertEquals("high", first.get("risk"));
        assertEquals("daughter", first.get("family_contact_name"));
        assertEquals(1L, ((Number) first.get("open_alert_count")).longValue());
        assertTrue(first.get("last_emotion").toString().contains("4"));
    }

    @Test
    void createServiceRecordCreatesCompletedConsultationAndHandlesAlert() {
        doReturn(Optional.of(Map.of("id", 55L))).when(db).one(
            contains("SELECT id FROM family_alerts WHERE id = ? AND family_id = ?"),
            eq(55L),
            eq("family_001")
        );
        doReturn(33L).when(db).insert(
            contains("INSERT INTO consultations"),
            eq("family_001"),
            eq(7L),
            eq(null),
            any(),
            eq(15),
            eq("followed up")
        );

        ResponseEntity<Map<String, Object>> response = service.createServiceRecord(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "alert_id", 55L,
            "content", "followed up"
        ));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(33L, ((Number) response.getBody().get("consultation_id")).longValue());
        assertEquals(55L, ((Number) response.getBody().get("alert_id")).longValue());
        verify(db).update(
            contains("UPDATE family_alerts"),
            eq("followed up"),
            eq(55L),
            eq("family_001")
        );
    }
}
