package com.dndadvlog.backend.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;

class InventoryReleaseCutoverIntegrationTest {
    @Test
    void baselineIncludesCommittedOldWritesAndRejectsSubsequentOldTransactions() throws Exception {
        try (var postgres = EmbeddedPostgres.builder().start()) {
            var source = postgres.getPostgresDatabase();
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("30").load().migrate();
            var jdbc = new JdbcTemplate(source);
            UUID user = UUID.randomUUID();
            UUID character = UUID.randomUUID();
            UUID item = UUID.randomUUID();
            jdbc.update("INSERT INTO users(id,email,display_name) VALUES (?,?,'Fixture')",
                    user, user + "@example.invalid");
            jdbc.update("""
                    INSERT INTO "character"(id,user_id,character_name,race,initial_classes_string,current_classes_string)
                    VALUES (?,?,'Hero','Human','Fighter1','Fighter1')
                    """, character, user);
            jdbc.update("""
                    INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity)
                    VALUES (?,?,'Potion','CONSUMABLE',1)
                    """, item, character);

            var executor = Executors.newSingleThreadExecutor();
            try (var oldConnection = source.getConnection()) {
                oldConnection.setAutoCommit(false);
                try (var statement = oldConnection.prepareStatement("UPDATE inventory_item SET quantity=2 WHERE id=?")) {
                    statement.setObject(1, item);
                    statement.executeUpdate();
                }
                var migration = executor.submit(() -> Flyway.configure().dataSource(source)
                        .locations("classpath:db/migration")
                        .initSql("SELECT set_config('advlog.install_inventory_guard', 'on', false)")
                        .load().migrate());
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                while (!Boolean.TRUE.equals(jdbc.queryForObject("""
                        SELECT EXISTS (SELECT 1 FROM pg_locks
                        WHERE relation='inventory_item'::regclass AND mode='AccessExclusiveLock' AND NOT granted)
                        """, Boolean.class))) {
                    if (migration.isDone() || System.nanoTime() >= deadline) {
                        fail("V31 did not wait for the old inventory transaction");
                    }
                    Thread.sleep(50);
                }
                oldConnection.commit();
                migration.get(30, TimeUnit.SECONDS);
            } finally {
                executor.shutdownNow();
            }
            assertEquals(2, jdbc.queryForObject(
                    "SELECT quantity_after FROM inventory_movement WHERE item_id=?", Integer.class, item));

            var oldTransaction = new TransactionTemplate(new JdbcTransactionManager(source));
            assertThrows(DataAccessException.class, () -> oldTransaction.executeWithoutResult(status -> {
                jdbc.update("UPDATE \"character\" SET character_name='Changed' WHERE id=?", character);
                jdbc.update("DELETE FROM inventory_item WHERE id=?", item);
            }));
            assertEquals("Hero", jdbc.queryForObject(
                    "SELECT character_name FROM \"character\" WHERE id=?", String.class, character));
            assertThrows(DataAccessException.class, () -> jdbc.update("DELETE FROM \"character\" WHERE id=?", character));

            var currentTransaction = new TransactionTemplate(new InventoryTransactionConfig().transactionManager(source));
            currentTransaction.executeWithoutResult(status ->
                    jdbc.update("UPDATE inventory_item SET item_name='Renamed' WHERE id=?", item));
            assertEquals("Renamed", jdbc.queryForObject(
                    "SELECT item_name FROM inventory_item WHERE id=?", String.class, item));
            assertThrows(DataAccessException.class, () -> jdbc.update("DELETE FROM inventory_item WHERE id=?", item));
        }
    }
}
