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

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KinEchoApiServiceUserTest {
    @Mock
    KinEchoMapper db;

    @Mock
    AiCompanionService aiCompanion;

    @Mock
    ToastService toastService;

    KinEchoApiService service;

    @BeforeEach
    void setUp() {
        service = new KinEchoApiService(db, new KinEchoProperties(), aiCompanion, toastService, new ObjectMapper());
        when(db.string(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            Object value = invocation.getArgument(0);
            return value == null ? "" : value.toString();
        });
    }

    @Test
    void createUserRejectsUnknownUserType() {
        ResponseEntity<Map<String, Object>> response = service.createUser(Map.of(
            "user_type", "admin",
            "name", "测试用户",
            "family_id", "family_001"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void updateUserWritesAuditOperator() {
        when(db.one("SELECT id FROM users WHERE id = ? AND family_id = ? AND is_active = 1", 9L, "family_001"))
            .thenReturn(Optional.of(Map.of("id", 9L)));
        when(db.ok()).thenReturn(Map.of("success", true));

        ResponseEntity<Map<String, Object>> response = service.updateUser(9L, Map.of(
            "family_id", "family_001",
            "name", "李小雨",
            "phone", "13900000000",
            "operator", "admin"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(db).update(
            contains("updated_by = ?"),
            eq("李小雨"),
            eq("13900000000"),
            eq("admin"),
            eq(9L),
            eq("family_001")
        );
    }

    @Test
    void deleteUserSoftDeletesFamilyContactWithAuditOperator() {
        when(db.one("SELECT id, user_type FROM users WHERE id = ? AND family_id = ? AND is_active = 1", 9L, "family_001"))
            .thenReturn(Optional.of(Map.of("id", 9L, "user_type", "family")));
        when(db.ok()).thenReturn(Map.of("success", true));

        ResponseEntity<Map<String, Object>> response = service.deleteUser(9L, "family_001", "admin");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(db).update(contains("deleted_at = CURRENT_TIMESTAMP"), eq("admin"), eq(9L), eq("family_001"));
    }

    @Test
    void deleteUserRejectsElderlyProfile() {
        when(db.one("SELECT id, user_type FROM users WHERE id = ? AND family_id = ? AND is_active = 1", 1L, "family_001"))
            .thenReturn(Optional.of(Map.of("id", 1L, "user_type", "elderly")));

        ResponseEntity<Map<String, Object>> response = service.deleteUser(1L, "family_001", "admin");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
}
