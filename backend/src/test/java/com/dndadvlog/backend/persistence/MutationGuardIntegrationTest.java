package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.service.MutationGuard;
import com.dndadvlog.backend.service.AdventureEntryService;
import com.dndadvlog.backend.service.CharacterService;
import com.dndadvlog.backend.mapper.*;
import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.controller.CharacterController;
import com.dndadvlog.backend.exception.GlobalExceptionHandler;
import org.mybatis.spring.SqlSessionTemplate;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static com.dndadvlog.backend.service.MutationGuard.Resource.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL, migrations, and Spring transaction proxy; never connects to production. */
@Timeout(30)
class MutationGuardIntegrationTest {
    @Configuration
    @EnableTransactionManagement
    static class Transactions {}

    private static EmbeddedPostgres postgres;
    private static AnnotationConfigApplicationContext context;
    private static JdbcTemplate jdbc;
    private static MutationGuard guard;
    private static AdventureEntryService adventures;
    private static CharacterService characters;
    private static AdventureEntryMapper entries;
    private static CharacterMapper characterMapper;
    private static AdventureEntryMapper actualEntries;
    private static CharacterMapper actualCharacters;
    private UUID userId;
    private UUID characterId;
    private UUID entryId;

    @BeforeAll
    static void startDatabase() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        var source = postgres.getPostgresDatabase();
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(source);
        SqlSessionTemplate template = new SqlSessionTemplate(LedgerPersistenceIntegrationTest.buildSqlSessionFactory(source));
        actualEntries = template.getMapper(AdventureEntryMapper.class);
        actualCharacters = template.getMapper(CharacterMapper.class);
        entries = spy(actualEntries);
        characterMapper = spy(actualCharacters);
        context = new AnnotationConfigApplicationContext();
        context.register(Transactions.class);
        context.registerBean("transactionManager", DataSourceTransactionManager.class,
                () -> new DataSourceTransactionManager(source));
        context.registerBean(MutationGuard.class, () -> new MutationGuard(jdbc));
        context.registerBean(CharacterService.class, () -> new CharacterService(characterMapper, entries, template.getMapper(InventoryItemMapper.class)));
        context.registerBean(AdventureEntryService.class, () -> new AdventureEntryService(entries, characterMapper,
                template.getMapper(DowntimeActivityMapper.class), template.getMapper(AdventureGainedItemMapper.class),
                template.getMapper(StoryAwardMapper.class), context.getBean(CharacterService.class), template.getMapper(InventoryItemMapper.class)));
        context.refresh();
        guard = context.getBean(MutationGuard.class);
        adventures = context.getBean(AdventureEntryService.class);
        characters = context.getBean(CharacterService.class);
    }

    @AfterAll
    static void stopDatabase() throws Exception {
        if (context != null) context.close();
        if (postgres != null) postgres.close();
    }

    @BeforeEach
    void seed() {
        reset(entries, characterMapper);
        userId = UUID.randomUUID();
        characterId = UUID.randomUUID();
        entryId = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,email,display_name) VALUES (?,?,'Test')",
                userId, userId + "@example.invalid");
        jdbc.update("""
                INSERT INTO "character"(id,user_id,character_name,race,initial_classes_string,current_classes_string)
                VALUES (?,?,'Hero','Human','Fighter1','Fighter1')
                """, characterId, userId);
        insertEntry(entryId, true);
    }

    @AfterEach
    void clearSecurityContext() { SecurityContextHolder.clearContext(); }

    private MockMvc http() {
        var principal = UserPrincipal.builder().id(userId).email("test@example.invalid").build();
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, "", java.util.List.of()));
        return MockMvcBuilders.standaloneSetup(new CharacterController(characters, guard))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    private void insertEntry(UUID id, boolean withSnapshot) {
        jdbc.update("INSERT INTO adventure_entry(id,character_id,adventure_name,play_date) VALUES (?,?,'Before',DATE '2026-10-14')",
                id, characterId);
        if (withSnapshot) jdbc.update("""
                INSERT INTO adventure_gained_item(id,adventure_entry_id,item_name,item_type,quantity)
                VALUES (?,?,'Sword','PERMANENT',1)
                """, UUID.randomUUID(), id);
    }

    private UUID insertItem(UUID parent) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO inventory_item(id,character_id,adventure_entry_id,item_name,item_type,quantity) VALUES (?,?,?,'Sword','PERMANENT',1)",
                id, characterId, parent);
        return id;
    }

    private LocalDateTime time(String table, UUID id) {
        return jdbc.queryForObject("SELECT updated_at FROM " + table + " WHERE id=?", Timestamp.class, id).toLocalDateTime();
    }

    private void assertStatus(int status, Runnable action) {
        assertEquals(status, assertThrows(ResponseStatusException.class, action::run).getStatusCode().value());
    }

    @Test
    void timestampAdvancesEvenAcrossMultipleUpdatesInOneTransaction() {
        String expected = time("adventure_entry", entryId).toString();
        guard.mutate(ENTRY, entryId, userId, expected, () -> {
            LocalDateTime claimed = time("adventure_entry", entryId);
            jdbc.update("UPDATE adventure_entry SET adventure_name='After', updated_at=GREATEST(clock_timestamp()::timestamp,updated_at+INTERVAL '1 microsecond') WHERE id=?", entryId);
            assertTrue(time("adventure_entry", entryId).isAfter(claimed), "DB trigger must not replace monotonic time with transaction NOW()");
            return null;
        });
    }

    @Test
    void clockRollbackCannotReuseAnExistingToken() {
        UUID future = UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_entry(id,character_id,updated_at) VALUES (?,?,TIMESTAMP '2099-01-01 00:00:00.123456')", future, characterId);
        LocalDateTime old = time("adventure_entry", future);
        guard.mutate(ENTRY, future, userId, old.toString(), () -> null);
        assertTrue(time("adventure_entry", future).isAfter(old));
        assertStatus(409, () -> guard.mutate(ENTRY, future, userId, old.toString(), () -> null));
    }

    @Test
    void timestampMigrationCanBeReappliedWithoutAddingColumnsOrChangingData() throws Exception {
        LocalDateTime before = time("adventure_entry", entryId);
        Integer columns = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public'", Integer.class);
        try (var input = new org.springframework.core.io.ClassPathResource("db/migration/V28__make_update_timestamps_monotonic.sql").getInputStream()) {
            jdbc.execute(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
        assertEquals(columns, jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public'", Integer.class));
        assertEquals(before, time("adventure_entry", entryId));
    }

    @Test
    void httpMissingHeaderReturns428AndKeepsCharacter() throws Exception {
        http().perform(delete("/api/characters/{id}", characterId))
                .andExpect(status().is(428)).andExpect(jsonPath("$.status").value(428))
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM \"character\" WHERE id=?", Integer.class, characterId));
    }

    @Test
    void httpStaleDeleteReturns409JsonInsteadOf500() throws Exception {
        String old = time("\"character\"", characterId).toString();
        guard.mutate(CHARACTER, characterId, userId, old, () -> null);
        http().perform(delete("/api/characters/{id}", characterId).header("X-Expected-Updated-At", old))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM \"character\" WHERE id=?", Integer.class, characterId));
    }

    @Test
    void httpFreshSaveBindsOriginalHeaderAndReturnsNewTimestamp() throws Exception {
        LocalDateTime old = time("\"character\"", characterId);
        http().perform(put("/api/characters/{id}", characterId)
                        .header("X-Expected-Updated-At", old.toString())
                        .contentType("application/json").content("{\"characterName\":\"Updated hero\",\"race\":\"Human\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.characterName").value("Updated hero"))
                .andExpect(jsonPath("$.updatedAt").isString());
        assertTrue(time("\"character\"", characterId).isAfter(old));
    }

    @Test
    void sixDigitTimestampIsAcceptedAndMillisecondTruncationRejected() {
        // Inserts permit an exact fixture without disabling any production trigger.
        UUID precise = UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_entry(id,character_id,updated_at) VALUES (?,?,TIMESTAMP '2026-10-14 01:02:03.123456')", precise, characterId);
        assertStatus(409, () -> guard.mutate(ENTRY, precise, userId, "2026-10-14T01:02:03.123", () -> null));
        assertEquals("saved", guard.mutate(ENTRY, precise, userId, "2026-10-14T01:02:03.123456", () -> "saved"));
    }

    @Test
    void missingInvalidAndNanosecondTokensNeverExecuteWrite() {
        LocalDateTime before = time("adventure_entry", entryId);
        AtomicBoolean called = new AtomicBoolean();
        for (String token : new String[]{null, "", "  "})
            assertStatus(428, () -> guard.mutate(ENTRY, entryId, userId, token, () -> called.getAndSet(true)));
        for (String token : new String[]{"invalid", "2026-10-14T01:02:03.123456789", "2026-10-14T01:02:03Z"})
            assertStatus(400, () -> guard.mutate(ENTRY, entryId, userId, token, () -> called.getAndSet(true)));
        assertFalse(called.get());
        assertEquals(before, time("adventure_entry", entryId));
    }

    @Test
    void anotherUserCannotClaimTheTimestamp() {
        LocalDateTime before = time("adventure_entry", entryId);
        assertThrows(ResourceNotFoundException.class, () -> guard.mutate(ENTRY, entryId, UUID.randomUUID(), before.toString(), () -> fail("unauthorized write")));
        assertEquals(before, time("adventure_entry", entryId));
    }

    @Test
    void concurrentSavesWithSameTokenOnlyCommitOnce() throws Exception {
        String expected = time("adventure_entry", entryId).toString();
        CountDownLatch firstClaimed = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicBoolean secondWrite = new AtomicBoolean();
        try {
            Future<String> first = pool.submit(() -> guard.mutate(ENTRY, entryId, userId, expected, () -> {
                firstClaimed.countDown();
                await(release);
                jdbc.update("UPDATE adventure_entry SET adventure_name='First' WHERE id=?", entryId);
                return "saved";
            }));
            assertTrue(firstClaimed.await(5, TimeUnit.SECONDS));
            Future<Integer> second = pool.submit(() -> {
                try {
                    guard.mutate(ENTRY, entryId, userId, expected, () -> secondWrite.getAndSet(true));
                    return 200;
                } catch (ResponseStatusException error) { return error.getStatusCode().value(); }
            });
            awaitDatabaseLock();
            assertFalse(second.isDone());
            release.countDown();
            assertEquals("saved", first.get(5, TimeUnit.SECONDS));
            assertEquals(409, second.get(5, TimeUnit.SECONDS));
            assertFalse(secondWrite.get());
            assertEquals("First", jdbc.queryForObject("SELECT adventure_name FROM adventure_entry WHERE id=?", String.class, entryId));
            assertStatus(409, () -> guard.mutate(ENTRY, entryId, userId, expected, () -> fail("retry overwrote data")));
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test
    void differentEntriesSerializeSharedCharacterTotals() throws Exception {
        UUID other = UUID.randomUUID();
        insertEntry(other, true);
        String tokenA = time("adventure_entry", entryId).toString(), tokenB = time("adventure_entry", other).toString();
        CountDownLatch firstClaimed = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = pool.submit(() -> guard.mutate(ENTRY, entryId, userId, tokenA, () -> {
                Integer old = jdbc.queryForObject("SELECT current_downtime FROM \"character\" WHERE id=?", Integer.class, characterId);
                firstClaimed.countDown(); await(release);
                jdbc.update("UPDATE \"character\" SET current_downtime=? WHERE id=?", old + 1, characterId);
                return null;
            }));
            assertTrue(firstClaimed.await(5, TimeUnit.SECONDS));
            Future<?> second = pool.submit(() -> guard.mutate(ENTRY, other, userId, tokenB, () -> {
                Integer old = jdbc.queryForObject("SELECT current_downtime FROM \"character\" WHERE id=?", Integer.class, characterId);
                jdbc.update("UPDATE \"character\" SET current_downtime=? WHERE id=?", old + 2, characterId);
                return null;
            }));
            awaitDatabaseLock(); release.countDown();
            first.get(5, TimeUnit.SECONDS); second.get(5, TimeUnit.SECONDS);
            assertEquals(3, jdbc.queryForObject("SELECT current_downtime FROM \"character\" WHERE id=?", Integer.class, characterId));
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test
    void failureRollsBackMainChildrenInventoryTotalsAndTokens() {
        UUID item = insertItem(entryId);
        LocalDateTime entryTime = time("adventure_entry", entryId), itemTime = time("inventory_item", item), characterTime = time("\"character\"", characterId);
        assertThrows(IllegalStateException.class, () -> guard.mutate(ENTRY, entryId, userId, entryTime.toString(), () -> {
            jdbc.update("UPDATE adventure_entry SET adventure_name='Partial' WHERE id=?", entryId);
            jdbc.update("DELETE FROM adventure_gained_item WHERE adventure_entry_id=?", entryId);
            jdbc.update("UPDATE inventory_item SET quantity=99 WHERE id=?", item);
            jdbc.update("UPDATE \"character\" SET current_downtime=99 WHERE id=?", characterId);
            throw new IllegalStateException("simulated write failure");
        }));
        assertEquals("Before", jdbc.queryForObject("SELECT adventure_name FROM adventure_entry WHERE id=?", String.class, entryId));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM adventure_gained_item WHERE adventure_entry_id=?", Integer.class, entryId));
        assertEquals(1, jdbc.queryForObject("SELECT quantity FROM inventory_item WHERE id=?", Integer.class, item));
        assertEquals(0, jdbc.queryForObject("SELECT current_downtime FROM \"character\" WHERE id=?", Integer.class, characterId));
        assertEquals(entryTime, time("adventure_entry", entryId));
        assertEquals(itemTime, time("inventory_item", item));
        assertEquals(characterTime, time("\"character\"", characterId));
        guard.mutate(ENTRY, entryId, userId, entryTime.toString(), () -> null);
    }

    @Test
    void childMutationsUseAndInvalidateParentToken() {
        UUID activity = UUID.randomUUID(), award = UUID.randomUUID();
        jdbc.update("INSERT INTO downtime_activity(id,adventure_entry_id,description) VALUES (?,?,'Rest')", activity, entryId);
        jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name) VALUES (?,?,'Award')", award, entryId);
        UUID gained = jdbc.queryForObject("SELECT id FROM adventure_gained_item WHERE adventure_entry_id=?", UUID.class, entryId);
        for (var child : new Object[][]{{ACTIVITY, activity}, {GAINED_ITEM, gained}, {STORY_AWARD, award}}) {
            String token = time("adventure_entry", entryId).toString();
            guard.mutate((MutationGuard.Resource) child[0], (UUID) child[1], userId, token, () -> null);
            assertStatus(409, () -> guard.mutate(ENTRY, entryId, userId, token, () -> fail("stale full save")));
        }
    }

    @Test
    void warehouseReassociationInvalidatesBothParentEntries() {
        UUID other = UUID.randomUUID(); insertEntry(other, true);
        UUID item = insertItem(entryId);
        String oldA = time("adventure_entry", entryId).toString(), oldB = time("adventure_entry", other).toString();
        guard.mutate(ITEM, item, userId, time("inventory_item", item).toString(), () -> {
            jdbc.update("UPDATE inventory_item SET adventure_entry_id=? WHERE id=?", other, item);
            return null;
        });
        assertStatus(409, () -> guard.mutate(ENTRY, entryId, userId, oldA, () -> null));
        assertStatus(409, () -> guard.mutate(ENTRY, other, userId, oldB, () -> null));
    }

    @Test
    void independentItemInvalidatesDefaultsAndLegacyFallbackButNotUnrelatedSnapshots() {
        UUID legacy = UUID.randomUUID(); insertEntry(legacy, false);
        String characterToken = time("\"character\"", characterId).toString(), legacyToken = time("adventure_entry", legacy).toString();
        String snapshotToken = time("adventure_entry", entryId).toString();
        guard.createItem(characterId, userId, () -> insertItem(null));
        assertStatus(409, () -> guard.mutate(CHARACTER, characterId, userId, characterToken, () -> null));
        assertStatus(409, () -> guard.mutate(ENTRY, legacy, userId, legacyToken, () -> null));
        assertEquals(snapshotToken, time("adventure_entry", entryId).toString());
    }

    @Test
    void completeReadCannotMixOldMainEntryWithNewChildren() throws Exception {
        String token = time("adventure_entry", entryId).toString();
        UUID activity = UUID.randomUUID(), award = UUID.randomUUID();
        jdbc.update("INSERT INTO downtime_activity(id,adventure_entry_id,description) VALUES (?,?,'Old rest')", activity, entryId);
        jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name) VALUES (?,?,'Old award')", award, entryId);
        ExecutorService writer = Executors.newSingleThreadExecutor();
        try {
            doAnswer(call -> {
                var old = actualEntries.findDetailSnapshot(entryId, userId); // Complete the statement snapshot, then commit before returning it.
                writer.submit(() -> guard.mutate(ENTRY, entryId, userId, token, () -> {
                    jdbc.update("UPDATE adventure_entry SET adventure_name='New' WHERE id=?", entryId);
                    jdbc.update("UPDATE adventure_gained_item SET item_name='New sword' WHERE adventure_entry_id=?", entryId);
                    jdbc.update("UPDATE downtime_activity SET description='New rest' WHERE id=?", activity);
                    jdbc.update("UPDATE adventure_story_award SET award_name='New award' WHERE id=?", award);
                    return null;
                })).get(5, TimeUnit.SECONDS);
                return old;
            }).when(entries).findDetailSnapshot(entryId, userId);
            var snapshot = adventures.getEntry(entryId, userId);
            assertEquals("Before", snapshot.getAdventureName());
            assertEquals(token, snapshot.getUpdatedAt().toString());
            assertEquals("Sword", snapshot.getGainedItems().get(0).getItemName());
            assertEquals("Old rest", snapshot.getDowntimeActivities().get(0).getDescription());
            assertEquals("Old award", snapshot.getStoryAwards().get(0).getAwardName());
            verify(entries).findDetailSnapshot(entryId, userId);
            verifyNoMoreInteractions(entries);
            reset(entries);
            var current = adventures.getEntry(entryId, userId);
            assertEquals("New", current.getAdventureName());
            assertEquals("New sword", current.getGainedItems().get(0).getItemName());
            assertTrue(current.getUpdatedAt().isAfter(snapshot.getUpdatedAt()));
        } finally { writer.shutdownNow(); }
    }

    @Test
    void defaultsKeepCharacterTokenAndQuantityInTheSameSnapshot() throws Exception {
        LocalDateTime token = time("\"character\"", characterId);
        ExecutorService writer = Executors.newSingleThreadExecutor();
        try {
            doAnswer(call -> {
                var old = actualEntries.findDefaultsSnapshot(characterId, userId);
                writer.submit(() -> guard.createItem(characterId, userId, () -> insertItem(null))).get(5, TimeUnit.SECONDS);
                return old;
            }).when(entries).findDefaultsSnapshot(characterId, userId);
            var snapshot = adventures.getDefaults(characterId, userId);
            assertEquals(token, snapshot.getCharacterUpdatedAt());
            assertEquals(0, snapshot.getStartingMagicItems());
            verify(entries).findDefaultsSnapshot(characterId, userId);
            verifyNoMoreInteractions(entries);
            reset(entries);
            var current = adventures.getDefaults(characterId, userId);
            assertEquals(1, current.getStartingMagicItems());
            assertTrue(current.getCharacterUpdatedAt().isAfter(token));
        } finally { writer.shutdownNow(); }
    }

    @Test
    void readSnapshotsKeepEmptyOwnershipBoundariesAndAllIndependentChildren() {
        UUID empty = UUID.randomUUID();
        jdbc.update("INSERT INTO \"character\"(id,user_id,character_name,race,initial_classes_string) VALUES (?,?,'Empty','Human','Fighter1')", empty, userId);
        assertTrue(adventures.getEntriesByCharacter(empty, userId).isEmpty());
        assertThrows(ResourceNotFoundException.class, () -> adventures.getEntriesByCharacter(characterId, UUID.randomUUID()));
        assertThrows(ResourceNotFoundException.class, () -> adventures.getEntriesByCharacter(UUID.randomUUID(), userId));
        assertThrows(ResourceNotFoundException.class, () -> adventures.getEntry(entryId, UUID.randomUUID()));
        assertThrows(ResourceNotFoundException.class, () -> adventures.getDefaults(characterId, UUID.randomUUID()));

        for (int index = 0; index < 2; index++) {
            jdbc.update("INSERT INTO downtime_activity(id,adventure_entry_id,description) VALUES (?,?,?)", UUID.randomUUID(), entryId, "Rest " + index);
        }
        for (int index = 0; index < 3; index++) {
            jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name) VALUES (?,?,?)", UUID.randomUUID(), entryId, "Award " + index);
        }
        jdbc.update("""
                INSERT INTO adventure_gained_item(id,adventure_entry_id,item_name,item_type,rarity,quantity,
                                                  is_soul_coin,requires_attunement,acquisition_source,needs_details)
                VALUES (?,?,'Coins','CONSUMABLE','RARE',3,TRUE,TRUE,'DOWNTIME',FALSE)
                """, UUID.randomUUID(), entryId);
        UUID unrelated = UUID.randomUUID(); insertEntry(unrelated, false);
        var list = adventures.getEntriesByCharacter(characterId, userId);
        assertEquals(2, list.size());
        var listed = list.stream().filter(e -> e.getId().equals(entryId)).findFirst().orElseThrow();
        assertEquals(2, listed.getDowntimeActivities().size());
        assertEquals(3, listed.getStoryAwards().size());
        assertEquals(time("adventure_entry", entryId), listed.getUpdatedAt());
        var detail = adventures.getEntry(entryId, userId);
        assertEquals(2, detail.getDowntimeActivities().size());
        assertEquals(3, detail.getStoryAwards().size());
        assertEquals(2, detail.getGainedItems().size());
        var coins = detail.getGainedItems().stream().filter(i -> i.getItemName().equals("Coins")).findFirst().orElseThrow();
        assertEquals("CONSUMABLE", coins.getItemType());
        assertEquals("RARE", coins.getRarity());
        assertEquals(com.dndadvlog.backend.entity.AcquisitionSource.DOWNTIME, coins.getAcquisitionSource());
        assertTrue(coins.getIsSoulCoin());
        assertTrue(coins.getRequiresAttunement());
        assertFalse(coins.getNeedsDetails());
        assertEquals(3, coins.getQuantity());
        assertEquals(time("adventure_entry", entryId), detail.getUpdatedAt());
        assertEquals(0, detail.getUpdatedAt().getNano() % 1000);
        assertTrue(detail.getLegacyItems().isEmpty());
        assertEquals(0, adventures.getEntry(unrelated, userId).getDowntimeActivities().size());
        assertEquals(0, adventures.getEntry(unrelated, userId).getStoryAwards().size());
    }

    @Test
    void detailSnapshotKeepsLegacyInventoryAndNextRecordWarnings() {
        UUID legacy = UUID.randomUUID(); insertEntry(legacy, false);
        UUID inventory = insertItem(null);
        jdbc.update("UPDATE adventure_entry SET play_date='2026-10-01', ending_classes_string='Fighter1', gold_total=10 WHERE id=?", legacy);
        jdbc.update("UPDATE adventure_entry SET play_date='2026-10-02', starting_classes_string='Fighter1', starting_gold=20 WHERE id=?", entryId);
        var snapshot = adventures.getEntry(legacy, userId);
        assertTrue(snapshot.getGainedItems().isEmpty());
        assertEquals(1, snapshot.getLegacyItems().size());
        assertEquals(inventory, snapshot.getLegacyItems().get(0).getId());
        assertEquals(time("inventory_item", inventory), snapshot.getLegacyItems().get(0).getUpdatedAt());
        assertTrue(snapshot.getWarnings().stream().anyMatch(w -> w.contains("不連續")));
        assertTrue(adventures.getEntry(entryId, userId).getLegacyItems().isEmpty());
    }

    @Test
    void listSnapshotCannotMixMainAndChildrenWhenAnotherConnectionCommits() throws Exception {
        UUID award = UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_story_award(id,adventure_entry_id,award_name) VALUES (?,?,'Old award')", award, entryId);
        String token = time("adventure_entry", entryId).toString();
        ExecutorService writer = Executors.newSingleThreadExecutor();
        try {
            doAnswer(call -> {
                var old = actualEntries.findListSnapshot(characterId, userId);
                writer.submit(() -> guard.mutate(ENTRY, entryId, userId, token, () -> {
                    jdbc.update("UPDATE adventure_entry SET adventure_name='New' WHERE id=?", entryId);
                    jdbc.update("UPDATE adventure_story_award SET award_name='New award' WHERE id=?", award);
                    return null;
                })).get(5, TimeUnit.SECONDS);
                return old;
            }).when(entries).findListSnapshot(characterId, userId);
            var old = adventures.getEntriesByCharacter(characterId, userId).get(0);
            assertEquals("Before", old.getAdventureName());
            assertEquals("Old award", old.getStoryAwards().get(0).getAwardName());
            assertEquals(token, old.getUpdatedAt().toString());
            verify(entries).findListSnapshot(characterId, userId);
            verifyNoMoreInteractions(entries);
            reset(entries);
            var current = adventures.getEntriesByCharacter(characterId, userId).get(0);
            assertEquals("New", current.getAdventureName());
            assertEquals("New award", current.getStoryAwards().get(0).getAwardName());
            assertTrue(current.getUpdatedAt().isAfter(old.getUpdatedAt()));
        } finally { writer.shutdownNow(); }
    }

    @Test
    void listSqlUsesLiveSoulCoinQuantitiesZeroAndOwnership() {
        UUID empty = UUID.randomUUID();
        jdbc.update("INSERT INTO \"character\"(id,user_id,character_name,race,initial_classes_string) VALUES (?,?,'Empty','Human','Fighter1')", empty, userId);
        jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity,is_soul_coin) VALUES (?,?,'Coins','CONSUMABLE',3,TRUE)", UUID.randomUUID(), characterId);
        jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity,is_soul_coin) VALUES (?,?,'More coins','CONSUMABLE',2,TRUE)", UUID.randomUUID(), characterId);
        jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity,is_soul_coin) VALUES (?,?,'Potion','CONSUMABLE',99,FALSE)", UUID.randomUUID(), characterId);
        jdbc.update("UPDATE \"character\" SET soul_coins=88 WHERE id=?", characterId);
        var list = characters.getAllCharacters(userId);
        assertEquals(2, list.size());
        assertEquals(5, list.stream().filter(c -> c.getId().equals(characterId)).findFirst().orElseThrow().getSoulCoins());
        assertEquals(0, list.stream().filter(c -> c.getId().equals(empty)).findFirst().orElseThrow().getSoulCoins());
        assertTrue(characters.getAllCharacters(UUID.randomUUID()).isEmpty());
    }

    private static void await(CountDownLatch latch) {
        try { if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("latch timed out"); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
    }

    private static void awaitDatabaseLock() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            if (jdbc.queryForObject("SELECT COUNT(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'", Integer.class) > 0) return;
            Thread.sleep(10);
        }
        fail("Second connection never waited for the actual PostgreSQL character lock");
    }
}
