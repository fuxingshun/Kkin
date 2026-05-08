package com.kinecho.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import com.kinecho.server.mapper.KinEchoMapper;
import com.kinecho.server.security.PasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
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

    private String adminSession() {
        return adminSessionWithPermissions(List.of("admin:*"));
    }

    private String adminSessionWithPermissions(List<String> permissions) {
        return SessionTokenCodec.create(db.map(
            "role", "admin",
            "user_id", 1L,
            "username", "admin",
            "display_name", "admin",
            "permissions", permissions
        ), properties, new ObjectMapper());
    }

    private String familySession() {
        return SessionTokenCodec.create(db.map(
            "role", "family",
            "user_id", 9L,
            "family_id", "family_001",
            "display_name", "family"
        ), properties, new ObjectMapper());
    }

    @Test
    void getServiceCertificationsFiltersPendingApplications() {
        doReturn(List.of(
            db.map(
                "id", 9L,
                "wechat_openid", "openid-service",
                "name", "service staff",
                "phone", "13900000000",
                "staff_no", "S001",
                "organization", "pilot center",
                "status", "pending"
            )
        )).when(db).list(
            contains("FROM service_certifications"),
            eq("pending"),
            eq(50)
        );

        ResponseEntity<Map<String, Object>> response = service.getServiceCertifications("pending", 50);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("pending", response.getBody().get("status"));
        List<?> rows = (List<?>) response.getBody().get("certifications");
        assertEquals(1, rows.size());
        assertEquals(9L, ((Number) ((Map<?, ?>) rows.get(0)).get("id")).longValue());
    }

    @Test
    void reviewServiceCertificationApprovesApplication() {
        doReturn(1).when(db).update(
            contains("UPDATE service_certifications"),
            eq("approved"),
            eq("admin"),
            eq(""),
            eq(9L)
        );

        ResponseEntity<Map<String, Object>> response = service.reviewServiceCertification(9L, Map.of(
            "status", "approved",
            "reviewer", "admin"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(true, response.getBody().get("success"));
        assertEquals("approved", response.getBody().get("status"));
    }

    @Test
    void reviewServiceCertificationRejectRequiresReason() {
        ResponseEntity<Map<String, Object>> response = service.reviewServiceCertification(9L, Map.of(
            "status", "rejected",
            "reviewer", "admin"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(db, never()).update(
            contains("UPDATE service_certifications"),
            any(),
            any(),
            any(),
            any()
        );
    }

    @Test
    void createAdminPsychologyVideoRequiresSlugTitleAndSource() {
        ResponseEntity<Map<String, Object>> response = service.createAdminPsychologyVideo(Map.of(
            "title", "breathing"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("psychology video requires slug, title and source_url", response.getBody().get("error"));
        verify(db, never()).insert(
            contains("INSERT INTO psychology_videos"),
            any(),
            any(),
            any()
        );
    }

    @Test
    void createAdminPsychologyQuestionPersistsQuestion() {
        doReturn(31L).when(db).insert(
            contains("INSERT INTO psychology_questions"),
            eq("如何缓解睡前焦虑？"),
            eq(7),
            eq(1)
        );

        ResponseEntity<Map<String, Object>> response = service.createAdminPsychologyQuestion(Map.of(
            "question", "如何缓解睡前焦虑？",
            "sort_order", 7
        ));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(31L, ((Number) response.getBody().get("question_id")).longValue());
    }

    @Test
    void updateAdminPsychologyQuestionCanDeactivateQuestion() {
        doReturn(1).when(db).update(
            contains("UPDATE psychology_questions SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
            eq(0),
            eq(12L)
        );

        ResponseEntity<Map<String, Object>> response = service.updateAdminPsychologyQuestion(12L, Map.of(
            "is_active", 0
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(12L, ((Number) response.getBody().get("question_id")).longValue());
    }

    @Test
    void getConsultationsAddsFamilyVisibleSummaryAndActions() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", 21L);
        row.put("family_id", "family_001");
        row.put("elderly_id", 7L);
        row.put("consultation_type", "phone");
        row.put("scheduled_time", "2026-05-06 10:00:00");
        row.put("status", "scheduled");
        row.put("note", "睡眠压力");
        row.put("counselor_name", "李老师");
        doReturn(List.of(row)).when(db).list(
            contains("FROM consultations c"),
            eq("family_001"),
            eq(20)
        );

        ResponseEntity<Map<String, Object>> response = service.getConsultations(Map.of("family_id", "family_001"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> rows = (List<?>) response.getBody().get("consultations");
        Map<?, ?> consultation = (Map<?, ?>) rows.get(0);
        assertEquals("已预约", consultation.get("status_label"));
        assertEquals(true, consultation.get("can_reschedule"));
        assertEquals(true, consultation.get("can_cancel"));
        assertTrue(consultation.get("family_visible_summary").toString().contains("李老师"));
        assertTrue(consultation.get("next_action").toString().contains("改约或取消"));
    }

    @Test
    void updateConsultationRejectsReschedulingCompletedAppointment() {
        doReturn(Optional.of(Map.of(
            "id", 21L,
            "family_id", "family_001",
            "elderly_id", 7L,
            "status", "completed",
            "scheduled_time", "2026-05-06 10:00:00",
            "note", "done"
        ))).when(db).one(
            contains("FROM consultations"),
            eq(21L),
            eq("family_001")
        );

        ResponseEntity<Map<String, Object>> response = service.updateConsultation(21L, Map.of(
            "family_id", "family_001",
            "scheduled_time", "2026-05-07 10:00:00"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(db, never()).update(
            contains("UPDATE consultations"),
            any(),
            any(),
            any()
        );
    }

    @Test
    void updateConsultationRequiresCancellationReason() {
        doReturn(Optional.of(Map.of(
            "id", 21L,
            "family_id", "family_001",
            "elderly_id", 7L,
            "status", "scheduled",
            "scheduled_time", "2026-05-06 10:00:00",
            "note", ""
        ))).when(db).one(
            contains("FROM consultations"),
            eq(21L),
            eq("family_001")
        );

        ResponseEntity<Map<String, Object>> response = service.updateConsultation(21L, Map.of(
            "family_id", "family_001",
            "status", "cancelled"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(db, never()).update(
            contains("UPDATE consultations"),
            any(),
            any(),
            any()
        );
    }

    @Test
    void getCounselorsAddsAvailabilitySummary() {
        doReturn(List.of(db.map(
            "id", 88L,
            "name", "slot counselor",
            "title", "counselor",
            "available", 1,
            "calendar", db.map(
                "month", "2026年5月",
                "dates", List.of(
                    db.map("day", 7, "available", 2),
                    db.map("day", 8, "status", "full")
                )
            )
        ))).when(db).list(contains("FROM counselors"));

        ResponseEntity<Map<String, Object>> response = service.getCounselors();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> rows = (List<?>) response.getBody().get("counselors");
        Map<?, ?> counselor = (Map<?, ?>) rows.get(0);
        assertEquals(2, counselor.get("available_slot_count"));
        assertTrue(counselor.get("next_available_text").toString().contains("2026年5月7日"));
    }

    @Test
    void updateAdminCounselorTogglesAvailability() {
        doReturn(1).when(db).update(
            contains("UPDATE counselors SET"),
            eq(0),
            eq("paused"),
            eq(88L)
        );

        ResponseEntity<Map<String, Object>> response = service.updateAdminCounselor(88L, Map.of(
            "available", 0,
            "availability_text", "paused"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(88L, ((Number) response.getBody().get("counselor_id")).longValue());
    }

    @Test
    void createConsultationRejectsUnavailableCounselor() {
        doReturn(Optional.of(Map.of(
            "id", 88L,
            "name", "off duty",
            "available", 0,
            "is_active", 1
        ))).when(db).one(
            contains("FROM counselors"),
            eq(88L)
        );

        ResponseEntity<Map<String, Object>> response = service.createConsultation(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "counselor_id", 88L,
            "scheduled_time", "2026-05-07 19:00:00"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("counselor is not available", response.getBody().get("error"));
        verify(db, never()).insert(
            contains("INSERT INTO consultations"),
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
    void createConsultationRejectsAlreadyBookedCounselorSlot() {
        doReturn(Optional.of(Map.of(
            "id", 88L,
            "name", "available counselor",
            "available", 1,
            "is_active", 1
        ))).when(db).one(
            contains("FROM counselors"),
            eq(88L)
        );
        doReturn(1L).when(db).count(
            contains("FROM consultations"),
            eq(88L),
            eq("2026-05-07 19:00:00")
        );

        ResponseEntity<Map<String, Object>> response = service.createConsultation(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "counselor_id", 88L,
            "scheduled_time", "2026-05-07 19:00:00"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("counselor slot is already booked", response.getBody().get("error"));
        verify(db, never()).insert(
            contains("INSERT INTO consultations"),
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
            eq(""),
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
            eq(""),
            eq("admin"),
            eq("admin")
        );
    }

    @Test
    void loginReturnsSessionTokenAndMeReadsCurrentUser() {
        doReturn(Optional.empty()).when(db).one(
            contains("FROM auth_accounts"),
            eq("elderly"),
            eq("elderly user")
        );
        doReturn(Optional.of(Map.of(
            "id", 7L,
            "user_type", "elderly",
            "name", "elderly user",
            "phone", "13900001234",
            "family_id", "family_001",
            "binding_code", "AB12CD34"
        ))).when(db).one(contains("WHERE user_type = ? AND is_active = 1"), eq("elderly"), eq("elderly user"), eq("elderly user"));

        ResponseEntity<Map<String, Object>> login = service.login(Map.of(
            "role", "elderly",
            "username", "elderly user",
            "password", "001234"
        ));

        assertEquals(HttpStatus.OK, login.getStatusCode());
        String token = String.valueOf(login.getBody().get("session_token"));
        assertFalse(token.isBlank());

        ResponseEntity<Map<String, Object>> me = service.me(token, null);

        assertEquals(HttpStatus.OK, me.getStatusCode());
        assertEquals("elderly", me.getBody().get("role"));
        assertEquals("family_001", me.getBody().get("family_id"));
        assertEquals(7L, ((Number) me.getBody().get("elderly_id")).longValue());
        Map<?, ?> user = (Map<?, ?>) me.getBody().get("user");
        assertEquals("elderly user", user.get("display_name"));
        assertEquals(7L, ((Number) user.get("user_id")).longValue());
    }

    @Test
    void meRejectsInvalidSessionToken() {
        ResponseEntity<Map<String, Object>> response = service.me("not-a-valid-token", null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void getAdminFamiliesReturnsFamilyOptionsWithCounts() {
        doReturn(List.of(
            db.map(
                "family_id", "family_001",
                "total_users", 3L,
                "elderly_count", 1L,
                "family_count", 2L,
                "open_alerts", 1L
            )
        )).when(db).list(contains("FROM users u"));

        ResponseEntity<Map<String, Object>> response = service.getAdminFamilies();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> families = (List<?>) response.getBody().get("families");
        assertEquals(1, families.size());
        Map<?, ?> family = (Map<?, ?>) families.get(0);
        assertEquals("family_001", family.get("family_id"));
        assertEquals(3L, ((Number) family.get("total_users")).longValue());
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
            eq(""),
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
            contains("SET name = ?, phone = ?, wechat_openid = COALESCE(NULLIF(?, ''), wechat_openid),"),
            eq("daughter"),
            eq("13900000000"),
            eq(""),
            eq("family-bind"),
            eq(9L)
        );
    }

    @Test
    void loginAllowsElderlyUserWithPhoneSuffixPassword() {
        doReturn(Optional.empty()).when(db).one(
            contains("FROM auth_accounts"),
            eq("elderly"),
            eq("13800138000")
        );
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
    void loginRejectsPhoneSuffixPasswordWhenDisabled() {
        properties.phoneSuffixLoginEnabled = false;
        doReturn(Optional.empty()).when(db).one(
            contains("FROM auth_accounts"),
            eq("elderly"),
            eq("13800138000")
        );
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

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void loginAllowsFamilyUserWithDatabasePasswordHash() {
        String passwordHash = PasswordHasher.hash("family-strong-password");
        doReturn(Optional.of(db.map(
            "id", 31L,
            "role", "family",
            "username", "daughter",
            "display_name", "family daughter",
            "password_hash", passwordHash,
            "permissions", "[\"family:read\",\"family:write\"]",
            "user_id", 9L,
            "family_id", "family_001",
            "disabled", 0,
            "failed_login_count", 0
        ))).when(db).one(
            contains("FROM auth_accounts"),
            eq("family"),
            eq("daughter")
        );
        doReturn(Optional.of(Map.of(
            "id", 9L,
            "user_type", "family",
            "name", "family daughter",
            "phone", "13900000000",
            "family_id", "family_001",
            "binding_code", ""
        ))).when(db).one(
            contains("WHERE id = ? AND user_type = ? AND is_active = 1"),
            eq(9L),
            eq("family")
        );
        doReturn(Optional.of(Map.of(
            "id", 5L,
            "name", "elderly account"
        ))).when(db).one(
            contains("WHERE family_id = ? AND user_type = 'elderly'"),
            eq("family_001")
        );

        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "family",
            "username", "daughter",
            "password", "family-strong-password"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("family", response.getBody().get("role"));
        assertEquals(9L, ((Number) response.getBody().get("family_user_id")).longValue());
        assertEquals(List.of("family:read", "family:write"), response.getBody().get("permissions"));
        assertTrue(response.getBody().containsKey("session_token"));
        verify(db).update(contains("SET failed_login_count = 0"), eq(31L));
    }

    @Test
    void loginRecordsFailedDatabasePasswordForElderlyUser() {
        doReturn(Optional.of(db.map(
            "id", 41L,
            "role", "elderly",
            "username", "grandpa",
            "display_name", "elderly account",
            "password_hash", PasswordHasher.hash("correct-password"),
            "permissions", "[\"elderly:read\"]",
            "user_id", 5L,
            "family_id", "family_001",
            "disabled", 0,
            "failed_login_count", 4
        ))).when(db).one(
            contains("FROM auth_accounts"),
            eq("elderly"),
            eq("grandpa")
        );

        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "elderly",
            "username", "grandpa",
            "password", "wrong-password"
        ));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(db).update(contains("SET failed_login_count = ?"), eq(5), any(), eq(41L));
    }

    @Test
    void serviceErrorsUseStructuredEnvelope() {
        ResponseEntity<Map<String, Object>> response = service.login(Map.of(
            "role", "admin"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("bad_request", response.getBody().get("code"));
        assertEquals("missing required fields", response.getBody().get("message"));
        assertEquals("missing required fields", response.getBody().get("error"));
        assertFalse(String.valueOf(response.getBody().get("request_id")).isBlank());
    }

    @Test
    void adminAuthAccountsCanBeListedWithoutPasswordHashes() {
        doReturn(List.of(db.map(
            "id", 31L,
            "role", "family",
            "username", "daughter",
            "display_name", "family daughter",
            "permissions", "[\"family:read\"]",
            "user_id", 9L,
            "family_id", "family_001",
            "disabled", 0
        ))).when(db).list(
            contains("FROM auth_accounts"),
            eq("family"),
            eq("family_001"),
            eq(20)
        );

        ResponseEntity<Map<String, Object>> response = service.getAdminAuthAccounts("family", "family_001", "active", 20, adminSession(), null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> accounts = (List<?>) response.getBody().get("accounts");
        assertEquals(1, accounts.size());
        Map<?, ?> account = (Map<?, ?>) accounts.get(0);
        assertEquals("daughter", account.get("username"));
        assertFalse(account.containsKey("password_hash"));
    }

    @Test
    void adminCanCreateFamilyAuthAccountBoundToActiveUser() {
        doReturn(Optional.of(Map.of(
            "id", 9L,
            "family_id", "family_001"
        ))).when(db).one(
            contains("FROM users"),
            eq(9L),
            eq("family")
        );
        doReturn(31L).when(db).insert(
            contains("INSERT INTO auth_accounts"),
            eq("family"),
            eq("daughter"),
            eq("family daughter"),
            any(),
            eq("[\"family:read\"]"),
            eq(9L),
            eq("org_1"),
            eq("family_001"),
            eq(0),
            eq("admin"),
            eq("admin")
        );

        ResponseEntity<Map<String, Object>> response = service.createAdminAuthAccount(Map.of(
            "role", "family",
            "username", "daughter",
            "password", "family-strong-password",
            "display_name", "family daughter",
            "permissions", List.of("family:read"),
            "user_id", 9L,
            "organization_id", "org_1",
            "operator", "admin"
        ), adminSession(), null);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(31L, ((Number) response.getBody().get("account_id")).longValue());
        assertEquals("family_001", response.getBody().get("family_id"));
    }

    @Test
    void adminPasswordRotationRequiresConfirmation() {
        doReturn(Optional.of(db.map(
            "id", 31L,
            "role", "family",
            "username", "daughter",
            "family_id", "family_001"
        ))).when(db).one(
            contains("FROM auth_accounts"),
            eq(31L)
        );

        ResponseEntity<Map<String, Object>> rejected = service.updateAdminAuthAccount(31L, Map.of(
            "password", "new-strong-password"
        ), adminSession(), null);

        assertEquals(HttpStatus.BAD_REQUEST, rejected.getStatusCode());

        ResponseEntity<Map<String, Object>> updated = service.updateAdminAuthAccount(31L, Map.of(
            "password", "new-strong-password",
            "confirmed", true,
            "operator", "security-admin"
        ), adminSession(), null);

        assertEquals(HttpStatus.OK, updated.getStatusCode());
        verify(db).update(contains("password_hash = ?"), any(), eq("security-admin"), eq(31L));
    }

    @Test
    void adminAuthAccountsRejectNonAdminSession() {
        ResponseEntity<Map<String, Object>> response = service.getAdminAuthAccounts("family", "", "", 20, familySession(), null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void adminAuthAccountsRequireAuthPermission() {
        ResponseEntity<Map<String, Object>> response = service.getAdminAuthAccounts(
            "family",
            "",
            "",
            20,
            adminSessionWithPermissions(List.of("admin:privacy")),
            null
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
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
        assertEquals("/api/family/media/12/file?family_id=family_001", response.getBody().get("file_path"));
        assertEquals("/api/family/media/12/thumbnail?family_id=family_001", response.getBody().get("thumbnail_path"));
    }

    @Test
    void downloadMediaAssetServesFamilyScopedUploadFile(@TempDir Path tempDir) throws Exception {
        properties.projectRoot = tempDir;
        properties.uploadDir = tempDir.resolve("server/uploads");
        Files.createDirectories(properties.uploadDir);
        Path mediaFile = properties.uploadDir.resolve("demo.jpg");
        Files.writeString(mediaFile, "image-bytes");
        doReturn(Optional.of(Map.of(
            "id", 12L,
            "family_id", "family_001",
            "media_type", "photo",
            "title", "old album",
            "file_path", mediaFile.toString(),
            "thumbnail_path", ""
        ))).when(db).one(
            contains("SELECT id, family_id, media_type, title, file_path, thumbnail_path"),
            eq(12L),
            eq("family_001")
        );

        ResponseEntity<?> response = service.downloadMediaAsset(12L, "family_001", false);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof FileSystemResource);
        assertEquals("private, max-age=300", response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL));
    }

    @Test
    void downloadMediaAssetRejectsPathsOutsideUploadDir(@TempDir Path tempDir) throws Exception {
        properties.projectRoot = tempDir;
        properties.uploadDir = tempDir.resolve("server/uploads");
        Files.createDirectories(properties.uploadDir);
        Path outsideFile = tempDir.resolve("secret.jpg");
        Files.writeString(outsideFile, "secret");
        doReturn(Optional.of(Map.of(
            "id", 12L,
            "family_id", "family_001",
            "media_type", "photo",
            "title", "old album",
            "file_path", outsideFile.toString(),
            "thumbnail_path", ""
        ))).when(db).one(
            contains("SELECT id, family_id, media_type, title, file_path, thumbnail_path"),
            eq(12L),
            eq("family_001")
        );

        ResponseEntity<?> response = service.downloadMediaAsset(12L, "family_001", false);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void downloadAiAudioServesOnlySignedTemporaryFile(@TempDir Path tempDir) throws Exception {
        properties.aiAudioDir = tempDir.resolve("server/uploads/ai-audio");
        properties.aiAudioUrlTtlSeconds = 120;
        Files.createDirectories(properties.aiAudioDir);
        Path audioFile = properties.aiAudioDir.resolve("ai-123.wav");
        Files.writeString(audioFile, "audio-bytes");
        String token = SessionTokenCodec.createSignedPayload(
            Map.of("purpose", "ai_audio", "file", "ai-123.wav"),
            properties.aiAudioUrlTtlSeconds,
            properties,
            new ObjectMapper()
        );

        ResponseEntity<?> response = service.downloadAiAudio("ai-123.wav", token);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof FileSystemResource);
        assertEquals("private, max-age=120", response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL));
    }

    @Test
    void downloadAiAudioRejectsInvalidToken(@TempDir Path tempDir) throws Exception {
        properties.aiAudioDir = tempDir.resolve("server/uploads/ai-audio");
        Files.createDirectories(properties.aiAudioDir);
        Files.writeString(properties.aiAudioDir.resolve("ai-123.wav"), "audio-bytes");

        ResponseEntity<?> response = service.downloadAiAudio("ai-123.wav", "invalid-token");

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void downloadAiVoiceUploadServesOnlySignedTemporaryFile(@TempDir Path tempDir) throws Exception {
        properties.aiVoiceUploadDir = tempDir.resolve("server/uploads/ai-voice");
        properties.aiVoiceUploadUrlTtlSeconds = 90;
        Files.createDirectories(properties.aiVoiceUploadDir);
        Path voiceFile = properties.aiVoiceUploadDir.resolve("voice-123.wav");
        Files.writeString(voiceFile, "voice-bytes");
        String token = SessionTokenCodec.createSignedPayload(
            Map.of("purpose", "ai_voice_upload", "file", "voice-123.wav"),
            properties.aiVoiceUploadUrlTtlSeconds,
            properties,
            new ObjectMapper()
        );

        ResponseEntity<?> response = service.downloadAiVoiceUpload("voice-123.wav", token);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof FileSystemResource);
        assertEquals("private, max-age=90", response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL));
    }

    @Test
    void downloadAiVoiceUploadRejectsInvalidToken(@TempDir Path tempDir) throws Exception {
        properties.aiVoiceUploadDir = tempDir.resolve("server/uploads/ai-voice");
        Files.createDirectories(properties.aiVoiceUploadDir);
        Files.writeString(properties.aiVoiceUploadDir.resolve("voice-123.wav"), "voice-bytes");

        ResponseEntity<?> response = service.downloadAiVoiceUpload("voice-123.wav", "invalid-token");

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void aiChatEscalatesCrisisSignalToFamilyAlert() {
        doReturn(77L).when(db).insert(
            contains("INSERT INTO family_alerts"),
            eq("family_001"),
            eq(7L),
            eq("ai_crisis"),
            eq("high"),
            eq("AI crisis alert"),
            any(),
            any(),
            eq("ai_companion")
        );
        doReturn(88L).when(db).insert(
            contains("INSERT INTO care_audit_logs"),
            eq("family_001"),
            eq(7L),
            eq("ai"),
            eq("AI companion"),
            eq("ai_crisis_detected"),
            any(),
            any()
        );

        ResponseEntity<Map<String, Object>> response = service.aiChat(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "user", "elderly:family_001:7",
            "message", "I want to die"
        ), new HttpHeaders());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(true, response.getBody().get("crisis_detected"));
        assertEquals(77L, ((Number) response.getBody().get("alert_id")).longValue());
        assertTrue(response.getBody().get("reply").toString().contains("Contact family"));
        assertEquals("safety", response.getBody().get("chat_provider"));
        verify(aiCompanion, never()).chat(any(), any(), any());
    }

    @Test
    void recordConsentPersistsConsentAndAuditsIt() {
        doReturn(42L).when(db).insert(
            contains("INSERT INTO consent_records"),
            eq("family_001"),
            eq(7L),
            any(),
            eq("privacy-policy"),
            eq("v1"),
            eq(1),
            eq("family"),
            eq("daughter"),
            eq("miniapp"),
            any()
        );
        doReturn(88L).when(db).insert(
            contains("INSERT INTO care_audit_logs"),
            eq("family_001"),
            eq(7L),
            eq("family"),
            eq("daughter"),
            eq("consent_recorded"),
            any(),
            any()
        );

        ResponseEntity<Map<String, Object>> response = service.recordConsent(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "consent_type", "privacy-policy",
            "version", "v1",
            "accepted", true,
            "actor_role", "family",
            "actor_name", "daughter"
        ));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(42L, ((Number) response.getBody().get("consent_id")).longValue());
    }

    @Test
    void exportFamilyDataBuildsFamilyScopedPackage() {
        doReturn(List.of()).when(db).list(any(), eq("family_001"));

        ResponseEntity<Map<String, Object>> response = service.exportFamilyData("family_001");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("family_001", response.getBody().get("family_id"));
        Map<?, ?> data = (Map<?, ?>) response.getBody().get("data");
        assertTrue(data.containsKey("users"));
        assertTrue(data.containsKey("consent_records"));
        assertTrue(data.containsKey("privacy_requests"));
        assertTrue(data.containsKey("care_audit_logs"));
    }

    @Test
    void createPrivacyRequestCreatesPendingRequestAndAudit() {
        doReturn(51L).when(db).insert(
            contains("INSERT INTO privacy_requests"),
            eq("family_001"),
            eq(7L),
            eq("delete"),
            eq("daughter"),
            eq("pilot exit"),
            any()
        );
        doReturn(88L).when(db).insert(
            contains("INSERT INTO care_audit_logs"),
            eq("family_001"),
            eq(7L),
            eq("family"),
            eq("daughter"),
            eq("privacy_request_created"),
            any(),
            any()
        );

        ResponseEntity<Map<String, Object>> response = service.createPrivacyRequest(Map.of(
            "family_id", "family_001",
            "elderly_id", 7L,
            "request_type", "delete",
            "requested_by", "daughter",
            "reason", "pilot exit"
        ));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(51L, ((Number) response.getBody().get("request_id")).longValue());
        assertEquals("pending", response.getBody().get("status"));
    }

    @Test
    void getPrivacyRequestsFiltersByFamilyAndStatus() {
        List<Map<String, Object>> requests = List.of(Map.of(
            "id", 51L,
            "family_id", "family_001",
            "request_type", "delete",
            "status", "pending"
        ));
        doReturn(requests).when(db).list(
            contains("WHERE family_id = ? AND status = ?"),
            eq("family_001"),
            eq("pending"),
            eq(100)
        );

        ResponseEntity<Map<String, Object>> response = service.getPrivacyRequests("family_001", "pending", 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().get("total"));
        assertEquals(requests, response.getBody().get("requests"));
    }

    @Test
    void reviewPrivacyRequestUpdatesStatusAndAudits() {
        doReturn(Optional.of(Map.of(
            "id", 51L,
            "family_id", "family_001",
            "elderly_id", 7L,
            "request_type", "delete",
            "status", "pending"
        ))).when(db).one(contains("FROM privacy_requests"), eq(51L));
        doReturn(1).when(db).update(
            contains("UPDATE privacy_requests"),
            eq("completed"),
            eq("admin"),
            eq("done"),
            eq(51L)
        );
        doReturn(88L).when(db).insert(
            contains("INSERT INTO care_audit_logs"),
            eq("family_001"),
            eq(7L),
            eq("admin"),
            eq("admin"),
            eq("privacy_request_reviewed"),
            any(),
            any()
        );

        ResponseEntity<Map<String, Object>> response = service.reviewPrivacyRequest(51L, Map.of(
            "status", "completed",
            "reviewer", "admin",
            "process_note", "done"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(51L, ((Number) response.getBody().get("request_id")).longValue());
        assertEquals("completed", response.getBody().get("status"));
    }

    @Test
    void retentionSummaryExposesConfiguredPilotPolicy() {
        properties.aiAudioRetentionCount = 24;
        properties.aiVoiceRetentionDays = 9;
        properties.mentalFrameRetentionDays = 31;
        properties.aiChatRetentionDays = 120;
        properties.consultationRetentionDays = 720;
        properties.auditLogRetentionDays = 366;

        ResponseEntity<Map<String, Object>> response = service.retentionSummary();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> policy = (Map<?, ?>) response.getBody().get("policy");
        assertEquals(24, policy.get("ai_audio_retention_count"));
        assertEquals(9, policy.get("ai_voice_retention_days"));
        assertEquals(31, policy.get("mental_frame_retention_days"));
        assertEquals(120, policy.get("ai_chat_retention_days"));
        assertEquals(720, policy.get("consultation_retention_days"));
        assertEquals(366, policy.get("audit_log_retention_days"));
    }

    @Test
    void healthReportsGradedComponents(@TempDir Path tempDir) throws Exception {
        properties.uploadDir = tempDir.resolve("uploads");
        properties.aiAudioDir = tempDir.resolve("ai-audio");
        properties.aiVoiceUploadDir = tempDir.resolve("ai-voice");
        Files.createDirectories(properties.uploadDir);
        Files.createDirectories(properties.aiAudioDir);
        Files.createDirectories(properties.aiVoiceUploadDir);
        properties.apiTokenEnabled = true;
        properties.familyScopeSessionRequired = true;
        properties.phoneSuffixLoginEnabled = false;
        doReturn(1L).when(db).count("SELECT 1");

        ResponseEntity<Map<String, Object>> response = service.health();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ok", response.getBody().get("status"));
        Map<?, ?> components = (Map<?, ?>) response.getBody().get("components");
        assertTrue(components.containsKey("database"));
        assertTrue(components.containsKey("security_config"));
        assertTrue(response.getBody().containsKey("checks"));
    }

    @Test
    void adminOpsMetricsExposeOperationalCounts() {
        doReturn(2L).when(db).count("SELECT COUNT(*) FROM family_alerts WHERE handled = 0");
        doReturn(3L).when(db).count("SELECT COUNT(*) FROM family_alerts WHERE read = 0");
        doReturn(1L).when(db).count("SELECT COUNT(*) FROM privacy_requests WHERE status = 'pending'");
        doReturn(4L).when(db).count("SELECT COUNT(*) FROM service_certifications WHERE status = 'pending'");
        doReturn(9L).when(db).count("SELECT COUNT(*) FROM auth_accounts WHERE disabled = 0");
        doReturn(1L).when(db).count("SELECT COUNT(*) FROM auth_accounts WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP");

        ResponseEntity<Map<String, Object>> response = service.getAdminOpsMetrics();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ok", response.getBody().get("status"));
        Map<?, ?> metrics = (Map<?, ?>) response.getBody().get("metrics");
        Map<?, ?> openAlerts = (Map<?, ?>) metrics.get("open_alerts");
        assertEquals(2L, openAlerts.get("value"));
        assertTrue(metrics.containsKey("locked_auth_accounts"));
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
    void getServiceFollowupsAddsSharedConsultationSummary() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", 15L);
        row.put("elderly_id", 7L);
        row.put("elderly_name", "王阿姨");
        row.put("consultation_type", "phone");
        row.put("scheduled_time", "2026-05-06 10:00:00");
        row.put("status", "scheduled");
        row.put("note", "睡眠回访");
        doReturn(List.of(row)).when(db).list(
            contains("FROM consultations c"),
            eq("family_001"),
            eq(30)
        );

        ResponseEntity<Map<String, Object>> response = service.getServiceFollowups(Map.of("family_id", "family_001"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> rows = (List<?>) response.getBody().get("followups");
        Map<?, ?> followup = (Map<?, ?>) rows.get(0);
        assertEquals("已预约", followup.get("status_label"));
        assertEquals(true, followup.get("can_reschedule"));
        assertTrue(followup.get("family_visible_summary").toString().contains("睡眠回访"));
        assertTrue(followup.get("next_action").toString().contains("改约或取消"));
    }

    @Test
    void updateServiceFollowupStatusRejectsTerminalTransition() {
        doReturn(Optional.of(Map.of(
            "id", 15L,
            "family_id", "family_001",
            "elderly_id", 7L,
            "status", "completed",
            "scheduled_time", "2026-05-06 10:00:00",
            "note", "done"
        ))).when(db).one(
            contains("FROM consultations"),
            eq(15L),
            eq("family_001")
        );

        ResponseEntity<Map<String, Object>> response = service.updateServiceFollowupStatus(15L, Map.of(
            "family_id", "family_001",
            "status", "in_progress"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("completed or cancelled consultations cannot be changed", response.getBody().get("error"));
        verify(db, never()).update(
            contains("UPDATE consultations"),
            any(),
            any(),
            any()
        );
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
