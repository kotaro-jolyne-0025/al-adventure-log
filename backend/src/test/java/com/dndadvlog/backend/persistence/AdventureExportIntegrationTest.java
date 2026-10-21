package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.dto.AdventureExportSnapshot;
import com.dndadvlog.backend.exception.*;
import com.dndadvlog.backend.mapper.*;
import com.dndadvlog.backend.service.*;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Timeout(30)
class AdventureExportIntegrationTest {
    @Configuration @EnableTransactionManagement static class Transactions {}
    private static EmbeddedPostgres postgres;
    private static AnnotationConfigApplicationContext context;
    private static JdbcTemplate jdbc;
    private static DataSourceTransactionManager transactions;
    private static AdventureExportReadService exports;
    private static AdventureEntryMapper entries;
    private static AdventureGainedItemMapper gains;
    private static InventoryItemMapper inventory;
    private static UserMapper users;
    private static CharacterMapper characters;
    private UUID owner, character, entry, legacy;

    @BeforeAll static void start() throws Exception {
        postgres = EmbeddedPostgres.builder().start(); var source = postgres.getPostgresDatabase();
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(source); transactions = new DataSourceTransactionManager(source);
        var sql = new SqlSessionTemplate(LedgerPersistenceIntegrationTest.buildSqlSessionFactory(source));
        entries = spy(sql.getMapper(AdventureEntryMapper.class)); gains = spy(sql.getMapper(AdventureGainedItemMapper.class));
        inventory = spy(sql.getMapper(InventoryItemMapper.class)); users = spy(sql.getMapper(UserMapper.class)); characters = spy(sql.getMapper(CharacterMapper.class));
        context = new AnnotationConfigApplicationContext(); context.register(Transactions.class);
        context.registerBean("transactionManager", DataSourceTransactionManager.class, () -> transactions);
        context.registerBean(CharacterService.class, () -> new CharacterService(characters, entries, inventory));
        context.registerBean(AdventureEntryService.class, () -> new AdventureEntryService(entries, characters,
                sql.getMapper(DowntimeActivityMapper.class), gains, sql.getMapper(StoryAwardMapper.class), context.getBean(CharacterService.class), inventory));
        context.registerBean(AdventureExportReadService.class, () -> new AdventureExportReadService(context.getBean(CharacterService.class), users, entries, gains, inventory, context.getBean(AdventureEntryService.class)));
        context.refresh(); exports = context.getBean(AdventureExportReadService.class);
    }
    @AfterAll static void stop() throws Exception { if (context != null) context.close(); if (postgres != null) postgres.close(); }
    @BeforeEach void seed() {
        reset(entries, gains, inventory, users, characters);
        owner = UUID.randomUUID(); character = UUID.randomUUID(); entry = UUID.randomUUID(); legacy = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,email,display_name) VALUES (?,?,'目前玩家')", owner, owner + "@example.invalid");
        jdbc.update("""
                INSERT INTO "character"(id,user_id,character_name,player_name,race,initial_classes_string,current_classes_string,current_gold)
                VALUES (?,?,'試作角色','過期玩家','Human','Wizard1','Wizard5',999.75)
                """, character, owner);
        insertEntry(entry, "2026-10-18", "2026-10-18 10:00:00");
        insertEntry(legacy, null, "2026-10-18 10:00:00");
        jdbc.update("INSERT INTO adventure_gained_item(id,adventure_entry_id,item_name,item_type,quantity) VALUES (?,?,'治療藥水','CONSUMABLE',4)", UUID.randomUUID(), entry);
        jdbc.update("INSERT INTO inventory_item(id,character_id,adventure_entry_id,item_name,item_type,quantity) VALUES (?,?,?,'治療藥水','CONSUMABLE',1)", UUID.randomUUID(), character, entry);
        jdbc.update("INSERT INTO inventory_item(id,character_id,adventure_entry_id,item_name,item_type,quantity) VALUES (?,?,?,'舊物品','CONSUMABLE',2)", UUID.randomUUID(), character, legacy);
        jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity,source) VALUES (?,?,'不可模糊匹配','CONSUMABLE',5,'試作冒險')", UUID.randomUUID(), character);
        jdbc.update("INSERT INTO downtime_activity(id,adventure_entry_id,description) VALUES (?,?,'抄寫法術')", UUID.randomUUID(), entry);
        jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name,description) VALUES (?,?,'森林之友','完整敘述')", UUID.randomUUID(), entry);
        jdbc.update("INSERT INTO downtime_activity(id,adventure_entry_id,description) VALUES (?,?,'第二項活動')", UUID.randomUUID(), entry);
        for (int i = 0; i < 2; i++) jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name) VALUES (?,?,'其他獎勵')", UUID.randomUUID(), entry);
    }
    private void insertEntry(UUID id, String date, String created) {
        jdbc.update("""
                INSERT INTO adventure_entry(id,character_id,adventure_name,play_date,created_at,starting_gold,gold_change,gold_downtime_change,gold_total,recording_model_version)
                VALUES (?,?,'試作冒險',?::date,?::timestamp,100.50,40,-20.25,120.25,1)
                """, id, character, date, created);
    }
    @Test void preservesHistoricalDataAndReadsOnlyExplicitLegacyLinksWithoutWrites() {
        var before = jdbc.queryForList("SELECT id,updated_at FROM adventure_entry WHERE character_id=? ORDER BY id", character);
        var snapshot = exports.read(character, owner);
        assertEquals("目前玩家", snapshot.character().getPlayerName()); assertNull(snapshot.character().getUserId()); assertNull(snapshot.character().getAvatarUrl());
        assertEquals(new BigDecimal("999.75"), snapshot.character().getCurrentGold());
        assertEquals(List.of(entry, legacy), snapshot.entries().stream().map(e -> e.getId()).toList());
        var e = snapshot.entries().get(0);
        assertEquals(new BigDecimal("120.25"), e.getGoldTotal()); assertEquals(4, e.getGainedItems().get(0).getQuantity()); assertTrue(e.getLegacyItems().isEmpty());
        assertTrue(e.getWarnings().isEmpty());
        assertEquals(2, e.getDowntimeActivities().size()); assertEquals(3, e.getStoryAwards().size());
        var old = snapshot.entries().get(1); assertTrue(old.getGainedItems().isEmpty()); assertEquals(1, old.getLegacyItems().size());
        assertEquals("舊物品", old.getLegacyItems().get(0).getItemName()); assertEquals(2, old.getLegacyItems().get(0).getQuantity());
        assertTrue(old.getWarnings().stream().anyMatch(w -> w.contains("原始獲得數量未知")));
        assertEquals(before, jdbc.queryForList("SELECT id,updated_at FROM adventure_entry WHERE character_id=? ORDER BY id", character));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM adventure_gained_item WHERE adventure_entry_id=?", Integer.class, entry));
        verify(characters).findByIdAndUserIdWithSummary(character, owner); verify(users).findById(owner);
        verify(entries).findListSnapshot(character, owner); verify(gains).findByOwnedCharacter(character, owner); verify(inventory).findByCharacterId(character);
        verifyNoMoreInteractions(characters, users, entries, gains, inventory);
    }
    @Test void comparesDatedHistoryWithoutTreatingUndatedLegacyRowsAsSuccessors() {
        var before = exports.read(character, owner); assertTrue(before.entries().get(0).getWarnings().isEmpty());
        UUID next = UUID.randomUUID(); insertEntry(next, "2026-10-19", "2026-10-19 10:00:00");
        jdbc.update("UPDATE adventure_entry SET starting_gold=80 WHERE id=?", next);
        var snapshot = exports.read(character, owner);
        assertTrue(snapshot.entries().get(0).getWarnings().stream().anyMatch(w -> w.contains("不連續")));
        assertEquals(new BigDecimal("120.25"), snapshot.entries().get(0).getGoldTotal());
        assertEquals(new BigDecimal("80.00"), snapshot.entries().get(1).getStartingGold());
    }
    @Test void rejectsOtherOwnersAndEmptyCharactersBeforeReadingChildren() {
        assertThrows(ResourceNotFoundException.class, () -> exports.read(character, UUID.randomUUID()));
        assertThrows(ResourceNotFoundException.class, () -> exports.read(UUID.randomUUID(), owner));
        verifyNoInteractions(entries, users, gains, inventory);
        jdbc.update("DELETE FROM adventure_entry WHERE character_id=?", character);
        assertEquals("尚無冒險紀錄可匯出", assertThrows(BusinessException.class, () -> exports.read(character, owner)).getMessage());
        verifyNoInteractions(gains, inventory);
    }
    @Test void stableNullLastOrderingAndBoundedQueriesForManyRecords() {
        UUID first = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID second = UUID.fromString("00000000-0000-0000-0000-000000000002");
        insertEntry(second, "2026-01-01", "2026-01-01 10:00:00"); insertEntry(first, "2026-01-01", "2026-01-01 10:00:00");
        for (int i = 0; i < 100; i++) insertEntry(UUID.randomUUID(), "2026-05-01", "2026-05-01 10:00:00");
        var snapshot = exports.read(character, owner);
        assertEquals(104, snapshot.entries().size()); assertEquals(first, snapshot.entries().get(0).getId()); assertEquals(second, snapshot.entries().get(1).getId());
        assertEquals(legacy, snapshot.entries().get(103).getId());
        verify(entries, times(1)).findListSnapshot(character, owner); verify(gains, times(1)).findByOwnedCharacter(character, owner);
        verifyNoMoreInteractions(entries, gains);
    }
    @Test void concurrentCommittedChangesCannotMixExportGenerations() throws Exception {
        var reached = new CountDownLatch(1); var resume = new CountDownLatch(1);
        doAnswer(call -> {
            Object result = call.callRealMethod(); reached.countDown();
            assertTrue(resume.await(10, TimeUnit.SECONDS)); return result;
        }).when(entries).findListSnapshot(character, owner);
        var executor = Executors.newSingleThreadExecutor();
        try {
            Future<AdventureExportSnapshot> reading = executor.submit(() -> exports.read(character, owner));
            assertTrue(reached.await(10, TimeUnit.SECONDS));
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                jdbc.update("UPDATE users SET display_name='新玩家' WHERE id=?", owner);
                jdbc.update("UPDATE \"character\" SET current_gold=2000 WHERE id=?", character);
                jdbc.update("UPDATE adventure_gained_item SET quantity=9 WHERE adventure_entry_id=?", entry);
                jdbc.update("UPDATE downtime_activity SET description='新活動' WHERE adventure_entry_id=?", entry);
                jdbc.update("UPDATE inventory_item SET quantity=8 WHERE adventure_entry_id=?", legacy);
            });
            resume.countDown(); var snapshot = reading.get(10, TimeUnit.SECONDS);
            assertEquals("目前玩家", snapshot.character().getPlayerName()); assertEquals(new BigDecimal("999.75"), snapshot.character().getCurrentGold());
            assertEquals(4, snapshot.entries().get(0).getGainedItems().get(0).getQuantity());
            assertEquals("抄寫法術", snapshot.entries().get(0).getDowntimeActivities().get(0).getDescription());
            assertEquals(2, snapshot.entries().get(1).getLegacyItems().get(0).getQuantity());
            var after = exports.read(character, owner); assertEquals(9, after.entries().get(0).getGainedItems().get(0).getQuantity());
        } finally { resume.countDown(); executor.shutdownNow(); }
    }
}
