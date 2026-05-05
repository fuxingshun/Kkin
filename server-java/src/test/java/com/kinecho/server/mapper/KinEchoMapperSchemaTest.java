package com.kinecho.server.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kinecho.server.config.KinEchoProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class KinEchoMapperSchemaTest {
    @Mock
    JdbcTemplate jdbc;

    @Test
    void initializeMigratesAlertStatsColumnsForLegacyTables() {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setSeedDemoData(false);
        KinEchoMapper mapper = new KinEchoMapper(jdbc, properties, new ObjectMapper());

        mapper.initialize();

        verify(jdbc).execute(contains("ALTER TABLE family_alerts ADD COLUMN handled INT DEFAULT 0"));
        verify(jdbc).execute(contains("ALTER TABLE family_alerts ADD COLUMN `read` INT DEFAULT 0"));
        verify(jdbc).execute(contains("ALTER TABLE family_alerts ADD COLUMN is_active INT DEFAULT 1"));
        verify(jdbc).update("UPDATE family_alerts SET handled = 0 WHERE handled IS NULL");
        verify(jdbc).update("UPDATE family_alerts SET `read` = 0 WHERE `read` IS NULL");
        verify(jdbc).update("UPDATE family_alerts SET is_active = 1 WHERE is_active IS NULL");
    }

    @Test
    void initializeMigratesFamilyMessageAndScheduleLifecycleColumns() {
        KinEchoProperties properties = new KinEchoProperties();
        properties.setSeedDemoData(false);
        KinEchoMapper mapper = new KinEchoMapper(jdbc, properties, new ObjectMapper());

        mapper.initialize();

        verify(jdbc).execute(contains("ALTER TABLE family_messages ADD COLUMN played INT DEFAULT 0"));
        verify(jdbc).execute(contains("ALTER TABLE family_messages ADD COLUMN is_active INT DEFAULT 1"));
        verify(jdbc).execute(contains("ALTER TABLE schedules ADD COLUMN status VARCHAR(64) DEFAULT 'pending'"));
        verify(jdbc).execute(contains("ALTER TABLE schedules ADD COLUMN is_active INT DEFAULT 1"));
        verify(jdbc).update("UPDATE family_messages SET played = 0 WHERE played IS NULL");
        verify(jdbc).update("UPDATE family_messages SET is_active = 1 WHERE is_active IS NULL");
        verify(jdbc).update("UPDATE schedules SET status = 'pending' WHERE status IS NULL OR status = ''");
        verify(jdbc).update("UPDATE schedules SET is_active = 1 WHERE is_active IS NULL");
    }
}
