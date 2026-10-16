package com.dndadvlog.backend.persistence;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.mapper.CharacterMapper;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.ObjectTypeHandler;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies a released-schema database with synthetic data can advance to the candidate schema. */
class MigrationUpgradeCompatibilityTest {
    @Test
    void releasedSchemaUpgradesAndPreservesOldApplicationReadsAndWrites() throws Exception {
        int releaseBoundary = Integer.parseInt(System.getenv().getOrDefault("MIGRATION_BASE_VERSION", "29"));
        UUID userId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        UUID entryId = UUID.randomUUID();

        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            var dataSource = postgres.getPostgresDatabase();
            Flyway.configure()
                    .dataSource(dataSource)
                    .locations("classpath:db/migration")
                    .target(MigrationVersion.fromVersion(Integer.toString(releaseBoundary)))
                    .load()
                    .migrate();

            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)",
                    userId, "migration-fixture@example.invalid", "Migration fixture");
            jdbc.update("""
                    INSERT INTO "character" (id, user_id, character_name, player_name, race,
                                               initial_classes_string, current_classes_string)
                    VALUES (?, ?, 'Upgrade fixture', 'CI player', 'Human', 'Fighter1', 'Fighter1')
                    """, characterId, userId);

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

            assertEquals("migration-fixture@example.invalid",
                    jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId));
            assertEquals("Upgrade fixture",
                    jdbc.queryForObject("SELECT character_name FROM \"character\" WHERE id = ?", String.class, characterId));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM \"character\" c JOIN users u ON u.id = c.user_id WHERE c.id = ?", Integer.class, characterId));

            // Exercise the stable columns used by the released application's ordinary character read/write path.
            assertEquals("Fighter1", jdbc.queryForObject(
                    "SELECT current_classes_string FROM \"character\" WHERE id = ?", String.class, characterId));
            jdbc.update("UPDATE \"character\" SET current_classes_string = ? WHERE id = ?", "Fighter2", characterId);
            assertEquals("Fighter2", jdbc.queryForObject(
                    "SELECT current_classes_string FROM \"character\" WHERE id = ?", String.class, characterId));

            String releasedMapperPath = System.getenv("MIGRATION_BASE_CHARACTER_MAPPER");
            if (releasedMapperPath != null && !releasedMapperPath.isBlank()) {
                var configuration = new org.apache.ibatis.session.Configuration(
                        new Environment("released-app", new JdbcTransactionFactory(), dataSource));
                configuration.setMapUnderscoreToCamelCase(true);
                configuration.getTypeHandlerRegistry()
                        .register(UUID.class, JdbcType.OTHER, ObjectTypeHandler.class);
                String mapperXml = Files.readString(Path.of(releasedMapperPath));
                new XMLMapperBuilder(new ByteArrayInputStream(mapperXml.getBytes(StandardCharsets.UTF_8)),
                        configuration, "released-CharacterMapper.xml", configuration.getSqlFragments()).parse();
                var factory = new SqlSessionFactoryBuilder().build(configuration);
                try (var session = factory.openSession(true)) {
                    CharacterMapper releasedMapper = session.getMapper(CharacterMapper.class);
                    Character loaded = releasedMapper.findByIdAndUserId(characterId, userId);
                    assertEquals("Upgrade fixture", loaded.getCharacterName());
                    releasedMapper.updateCurrentMagicItems(characterId, 1);
                }
                assertEquals(1, jdbc.queryForObject(
                        "SELECT current_magic_items FROM \"character\" WHERE id = ?", Integer.class, characterId));
            }

            jdbc.update("""
                    INSERT INTO adventure_entry (id, character_id, adventure_name)
                    VALUES (?, ?, 'Upgrade fixture entry')
                    """, entryId, characterId);
            assertTrue(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM adventure_entry WHERE id = ? AND character_id = ?)", Boolean.class, entryId, characterId));
        }
    }
}
