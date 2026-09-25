package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.AdventureGainedItem;
import com.dndadvlog.backend.entity.Character;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.dto.AdventureEntryRequest;
import com.dndadvlog.backend.dto.AdventureEntryResponse;
import com.dndadvlog.backend.dto.AdventureEntrySaveRequest;
import com.dndadvlog.backend.dto.ClassLevelChangeRequest;
import com.dndadvlog.backend.dto.DowntimeActivityRequest;
import com.dndadvlog.backend.dto.StoryAwardRequest;
import com.dndadvlog.backend.entity.DowntimeActivity;
import com.dndadvlog.backend.entity.StoryAward;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import com.dndadvlog.backend.service.AdventureEntryService;
import com.dndadvlog.backend.service.CharacterService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.ObjectTypeHandler;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.io.InputStream;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LedgerPersistenceIntegrationTest {

    private static final UUID USER_ID = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID LEGACY_CHARACTER_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID LEGACY_ENTRY_ID = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID LEGACY_GAINED_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final UUID LEGACY_LINKED_INVENTORY_ID = UUID.fromString("40000000-0000-0000-0000-000000000001");
    private static final UUID LEGACY_MANUAL_INVENTORY_ID = UUID.fromString("40000000-0000-0000-0000-000000000002");

    private static EmbeddedPostgres postgres;
    private static DataSource dataSource;
    private static SqlSessionFactory sqlSessionFactory;

    @BeforeAll
    static void startDatabaseAndMigrate() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        dataSource = postgres.getPostgresDatabase();

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("19")
                .load()
                .migrate();

        try (Connection connection = dataSource.getConnection()) {
            assertEquals(0, queryInt(connection, "SELECT COUNT(*) FROM users", null));
        }
        insertLegacyFixtures();

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        sqlSessionFactory = buildSqlSessionFactory(dataSource);
    }

    @AfterAll
    static void stopDatabase() throws Exception {
        if (postgres != null) {
            postgres.close();
        }
    }

    @Test
    void categoriesRoundTripAndClearWithoutChangingQuantities() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            try (var statement = connection.createStatement();
                    var migration = new ClassPathResource("db/migration/V25__add_item_category.sql").getInputStream()) {
                statement.execute(new String(migration.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
            assertNull(queryString(connection, "SELECT item_category FROM inventory_item WHERE id = ?", LEGACY_LINKED_INVENTORY_ID));
            assertNull(queryString(connection, "SELECT item_category FROM adventure_gained_item WHERE id = ?", LEGACY_GAINED_ID));
            for (String table : List.of("inventory_item", "adventure_gained_item")) {
                assertThrows(SQLException.class, () -> {
                    try (PreparedStatement statement = connection.prepareStatement(
                            "UPDATE " + table + " SET item_category = 'INVALID'")) {
                        statement.executeUpdate();
                    }
                });
            }
        }
        try (SqlSession session = sqlSessionFactory.openSession(false)) {
            InventoryItemMapper inventory = session.getMapper(InventoryItemMapper.class);
            AdventureGainedItemMapper gained = session.getMapper(AdventureGainedItemMapper.class);
            InventoryItem item = inventoryItem(LEGACY_CHARACTER_ID, AcquisitionSource.ADVENTURE, false);
            AdventureGainedItem snapshot = gainedItem(LEGACY_ENTRY_ID, AcquisitionSource.ADVENTURE, false);
            item.setItemCategory(InventoryItem.ItemCategory.ARMOR);
            snapshot.setItemCategory(InventoryItem.ItemCategory.ARMOR);
            inventory.insert(item);
            gained.insert(snapshot);
            assertEquals(item.getItemCategory(), inventory.findById(item.getId()).getItemCategory());
            assertEquals(snapshot.getItemCategory(), gained.findById(snapshot.getId()).getItemCategory());
            for (InventoryItem.ItemCategory category : InventoryItem.ItemCategory.values()) {
                item.setItemCategory(category);
                snapshot.setItemCategory(category);
                inventory.update(item);
                gained.update(snapshot);
                assertEquals(category, inventory.findById(item.getId()).getItemCategory());
                assertEquals(category, gained.findById(snapshot.getId()).getItemCategory());
            }
            item.setItemCategory(null);
            snapshot.setItemCategory(null);
            inventory.update(item);
            gained.update(snapshot);
            assertNull(inventory.findById(item.getId()).getItemCategory());
            assertNull(gained.findById(snapshot.getId()).getItemCategory());
            assertEquals(1, inventory.findById(item.getId()).getQuantity());
            assertEquals(1, gained.findById(snapshot.getId()).getQuantity());
            session.rollback();
        }
    }

    @Test
    void migrationBackfillsOnlyReliableLegacyValuesAndAddsConstraints() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertEquals("Fighter1", queryString(connection,
                    "SELECT initial_classes_string FROM \"character\" WHERE id = ?",
                    LEGACY_CHARACTER_ID));
            assertEquals("Fighter5", queryString(connection,
                    "SELECT current_classes_string FROM \"character\" WHERE id = ?",
                    LEGACY_CHARACTER_ID));
            assertEquals("Fighter1", queryString(connection,
                    "SELECT starting_classes_string FROM adventure_entry WHERE id = ?",
                    LEGACY_ENTRY_ID));
            assertEquals("Fighter5", queryString(connection,
                    "SELECT ending_classes_string FROM adventure_entry WHERE id = ?",
                    LEGACY_ENTRY_ID));
            assertEquals(1, queryInt(connection,
                    "SELECT recording_model_version FROM adventure_entry WHERE id = ?",
                    LEGACY_ENTRY_ID));
            assertEquals("ADVENTURE", queryString(connection,
                    "SELECT acquisition_source FROM adventure_gained_item WHERE id = ?",
                    LEGACY_GAINED_ID));
            assertEquals("ADVENTURE", queryString(connection,
                    "SELECT acquisition_source FROM inventory_item WHERE id = ?",
                    LEGACY_LINKED_INVENTORY_ID));
            assertNull(queryString(connection,
                    "SELECT acquisition_source FROM inventory_item WHERE id = ?",
                    LEGACY_MANUAL_INVENTORY_ID));
            assertFalse(queryBoolean(connection,
                    "SELECT needs_details FROM inventory_item WHERE id = ?",
                    LEGACY_MANUAL_INVENTORY_ID));

            assertThrows(SQLException.class, () -> {
                try (PreparedStatement statement = connection.prepareStatement(
                        "UPDATE inventory_item SET acquisition_source = 'MANUAL' WHERE id = ?")) {
                    statement.setObject(1, LEGACY_MANUAL_INVENTORY_ID);
                    statement.executeUpdate();
                }
            });
        }
    }

    @Test
    void englishClassConstraintsRejectUnknownLegacyIdentifiers() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThrows(SQLException.class, () -> executeUpdate(connection, """
                    UPDATE "character" SET current_classes_string = 'Homebrew1' WHERE id = ? AND user_id = ?
                    """, LEGACY_CHARACTER_ID, USER_ID));
        }
    }

    @Test
    void characterMapperRoundTripsBaselineAndCurrentResources() {
        try (SqlSession session = sqlSessionFactory.openSession(false)) {
            CharacterMapper mapper = session.getMapper(CharacterMapper.class);
            Character character = newCharacter();
            character.setInitialClassesString("Fighter1");
            character.setCurrentClassesString("Fighter3");
            character.setCurrentGold(new BigDecimal("12.50"));
            character.setCurrentDowntime(4);
            character.setCurrentMagicItems(2);

            mapper.insert(character);
            Character inserted = mapper.findById(character.getId());
            assertCharacterState(inserted, "Fighter1", "Fighter3", "12.50", 4, 2);

            inserted.setCurrentClassesString("Fighter4");
            inserted.setCurrentGold(new BigDecimal("22.75"));
            inserted.setCurrentDowntime(6);
            inserted.setCurrentMagicItems(3);
            mapper.update(inserted);

            Character updated = mapper.findById(character.getId());
            assertCharacterState(updated, "Fighter1", "Fighter4", "22.75", 6, 3);
            session.rollback();
        }
    }

    @Test
    void openingClassBaselineCannotBeNullOrBlank() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThrows(SQLException.class, () -> executeUpdate(connection, """
                    INSERT INTO "character" (id, user_id, character_name, race, initial_classes_string)
                    VALUES (?, ?, 'Missing baseline', 'Human', NULL)
                    """, UUID.randomUUID(), USER_ID));
            assertThrows(SQLException.class, () -> executeUpdate(connection, """
                    INSERT INTO "character" (id, user_id, character_name, race, initial_classes_string)
                    VALUES (?, ?, 'Blank baseline', 'Human', '')
                    """, UUID.randomUUID(), USER_ID));
        }
    }

    @Test
    void sanitizedBootstrapCreatesNoDefaultUserAndPreservesExistingData() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertEquals(1, queryInt(connection, "SELECT COUNT(*) FROM users", null));
            assertEquals("ledger-test@example.invalid", queryString(connection,
                    "SELECT email FROM users WHERE id = ?", USER_ID));
            assertNull(queryString(connection, "SELECT password_hash FROM users WHERE id = ?", USER_ID));
            assertTrue(queryBoolean(connection, "SELECT is_active FROM users WHERE id = ?", USER_ID));
            assertEquals("GOOGLE", queryString(connection,
                    "SELECT provider FROM user_oauth_accounts WHERE user_id = ?", USER_ID));
            assertEquals("Fighter1", queryString(connection,
                    "SELECT initial_classes_string FROM \"character\" WHERE id = ?", LEGACY_CHARACTER_ID));
        }
    }

    @Test
    void adventureAndItemMappersRoundTripVersionsSourcesNullAndPendingState() {
        try (SqlSession session = sqlSessionFactory.openSession(false)) {
            Character character = newCharacter();
            session.getMapper(CharacterMapper.class).insert(character);

            AdventureEntry entry = new AdventureEntry();
            entry.setId(UUID.randomUUID());
            entry.setCharacterId(character.getId());
            entry.setAdventureName("Delta ledger test");
            entry.setPlayDate(LocalDate.of(2026, 9, 19));
            entry.setRecordingModelVersion(2);
            session.getMapper(AdventureEntryMapper.class).insert(entry);
            assertEquals(2, session.getMapper(AdventureEntryMapper.class)
                    .findById(entry.getId()).getRecordingModelVersion());

            AdventureGainedItemMapper gainedMapper = session.getMapper(AdventureGainedItemMapper.class);
            List<AdventureGainedItem> snapshots = List.of(
                    gainedItem(entry.getId(), AcquisitionSource.ADVENTURE, false),
                    gainedItem(entry.getId(), AcquisitionSource.DOWNTIME, true),
                    gainedItem(entry.getId(), null, false));
            snapshots.forEach(gainedMapper::insert);

            assertEquals(AcquisitionSource.ADVENTURE,
                    gainedMapper.findById(snapshots.get(0).getId()).getAcquisitionSource());
            AdventureGainedItem downtime = gainedMapper.findById(snapshots.get(1).getId());
            assertEquals(AcquisitionSource.DOWNTIME, downtime.getAcquisitionSource());
            assertTrue(downtime.getNeedsDetails());
            assertNull(gainedMapper.findById(snapshots.get(2).getId()).getAcquisitionSource());

            InventoryItemMapper inventoryMapper = session.getMapper(InventoryItemMapper.class);
            List<InventoryItem> inventoryItems = List.of(
                    inventoryItem(character.getId(), AcquisitionSource.ADVENTURE, false),
                    inventoryItem(character.getId(), AcquisitionSource.DOWNTIME, true),
                    inventoryItem(character.getId(), null, false));
            inventoryItems.forEach(inventoryMapper::insert);

            assertEquals(AcquisitionSource.ADVENTURE,
                    inventoryMapper.findById(inventoryItems.get(0).getId()).getAcquisitionSource());
            InventoryItem downtimeInventory = inventoryMapper.findById(inventoryItems.get(1).getId());
            assertEquals(AcquisitionSource.DOWNTIME, downtimeInventory.getAcquisitionSource());
            assertTrue(downtimeInventory.getNeedsDetails());
            assertNull(inventoryMapper.findById(inventoryItems.get(2).getId()).getAcquisitionSource());

            InventoryItem consumable = inventoryItem(character.getId(), null, false);
            consumable.setItemType(InventoryItem.ItemType.CONSUMABLE);
            consumable.setQuantity(9);
            inventoryMapper.insert(consumable);
            assertEquals(3, inventoryMapper.sumQuantityByCharacterIdAndItemType(
                    character.getId(), InventoryItem.ItemType.PERMANENT.name()));
            session.rollback();
        }
    }

    @Test
    void predecessorQueriesUsePlayDateCreatedAtAndIdAndIgnoreLegacyNullDates() {
        try (SqlSession session = sqlSessionFactory.openSession(false)) {
            Character character = newCharacter();
            session.getMapper(CharacterMapper.class).insert(character);
            AdventureEntryMapper mapper = session.getMapper(AdventureEntryMapper.class);

            AdventureEntry legacyNullDate = entry(
                    UUID.fromString("50000000-0000-0000-0000-000000000001"),
                    character.getId(), null, "Legacy null");
            AdventureEntry first = entry(
                    UUID.fromString("50000000-0000-0000-0000-000000000002"),
                    character.getId(), LocalDate.of(2026, 9, 1), "First");
            AdventureEntry second = entry(
                    UUID.fromString("50000000-0000-0000-0000-000000000003"),
                    character.getId(), LocalDate.of(2026, 9, 1), "Second");
            mapper.insert(legacyNullDate);
            mapper.insert(first);
            mapper.insert(second);

            AdventureEntry latestSameDay = mapper.findPreviousForNew(
                    character.getId(), LocalDate.of(2026, 9, 1));
            assertEquals(second.getId(), latestSameDay.getId());

            AdventureEntry persistedSecond = mapper.findById(second.getId());
            AdventureEntry previous = mapper.findPreviousForExisting(
                    character.getId(), persistedSecond.getPlayDate(),
                    persistedSecond.getCreatedAt(), persistedSecond.getId());
            assertEquals(first.getId(), previous.getId());
            session.rollback();
        }
    }

    @Test
    void completeSaveRollsBackParentAndCharacterWhenAChildStepFails() {
        SqlSessionTemplate template = new SqlSessionTemplate(sqlSessionFactory);
        CharacterMapper characterMapper = template.getMapper(CharacterMapper.class);
        AdventureEntryMapper entryMapper = template.getMapper(AdventureEntryMapper.class);
        Character character = newCharacter();
        character.setInitialClassesString("Fighter1");
        character.setCurrentClassesString("Fighter1");
        TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        transaction.executeWithoutResult(status -> characterMapper.insert(character));

        CharacterService characterService = new CharacterService(characterMapper, entryMapper);
        AdventureEntryService service = new AdventureEntryService(
                entryMapper,
                characterMapper,
                template.getMapper(DowntimeActivityMapper.class),
                template.getMapper(AdventureGainedItemMapper.class),
                template.getMapper(StoryAwardMapper.class),
                characterService,
                template.getMapper(InventoryItemMapper.class));

        AdventureEntryRequest entryRequest = new AdventureEntryRequest();
        entryRequest.setPlayDate(LocalDate.of(2026, 9, 19));
        entryRequest.setLevelChange(0);
        entryRequest.setClassChanges(List.of());
        entryRequest.setGoldChange(new BigDecimal("25.00"));
        entryRequest.setGoldDowntimeChange(BigDecimal.ZERO);
        entryRequest.setDowntimeChange(0);
        entryRequest.setDowntimeDowntimeChange(0);
        entryRequest.setMagicItemsChange(0);
        entryRequest.setMagicItemsDowntimeChange(0);
        AdventureEntrySaveRequest saveRequest = new AdventureEntrySaveRequest();
        saveRequest.setEntry(entryRequest);
        saveRequest.setDowntimeActivities(List.of(new DowntimeActivityRequest()));
        saveRequest.setGainedItems(List.of());
        saveRequest.setStoryAwards(List.of());

        assertThrows(RuntimeException.class, () -> transaction.executeWithoutResult(
                status -> service.createEntryWithDetails(character.getId(), saveRequest, USER_ID)));

        assertTrue(entryMapper.findByCharacterIdOrderByPlayDateAsc(character.getId()).isEmpty());
        Character unchanged = characterMapper.findById(character.getId());
        assertEquals(0, unchanged.getCurrentGold().compareTo(BigDecimal.ZERO));
        assertEquals("Fighter1", unchanged.getCurrentClassesString());
    }

    @Test
    void adventureCrudPersistsChildrenAndReversesCharacterContribution() {
        SqlSessionTemplate template = new SqlSessionTemplate(sqlSessionFactory);
        CharacterMapper characterMapper = template.getMapper(CharacterMapper.class);
        AdventureEntryMapper entryMapper = template.getMapper(AdventureEntryMapper.class);
        DowntimeActivityMapper activityMapper = template.getMapper(DowntimeActivityMapper.class);
        StoryAwardMapper awardMapper = template.getMapper(StoryAwardMapper.class);
        TransactionTemplate transaction = new TransactionTemplate(
                new DataSourceTransactionManager(dataSource));

        Character character = newCharacter();
        character.setInitialClassesString("Fighter1");
        character.setCurrentClassesString("Fighter1");
        transaction.executeWithoutResult(status -> characterMapper.insert(character));

        AdventureEntryService service = new AdventureEntryService(
                entryMapper,
                characterMapper,
                activityMapper,
                template.getMapper(AdventureGainedItemMapper.class),
                awardMapper,
                new CharacterService(characterMapper, entryMapper),
                template.getMapper(InventoryItemMapper.class));

        AdventureEntryResponse created = transaction.execute(status ->
                service.createEntryWithDetails(character.getId(),
                        ledgerRequest("First adventure", 1, 1, "50.00", 2,
                                null, "First downtime", null, "First award"), USER_ID));

        assertEquals("First adventure", entryMapper.findById(created.getId()).getAdventureName());
        assertEquals(1, activityMapper.findByEntryIdOrderByCreatedAtAsc(created.getId()).size());
        assertEquals("First award", awardMapper.findByAdventureEntryId(created.getId()).get(0).getAwardName());
        assertCharacterState(characterMapper.findById(character.getId()),
                "Fighter1", "Fighter2", "50.00", 2, 0);

        DowntimeActivity activity = activityMapper.findByEntryIdOrderByCreatedAtAsc(created.getId()).get(0);
        StoryAward award = awardMapper.findByAdventureEntryId(created.getId()).get(0);
        AdventureEntryResponse updated = transaction.execute(status ->
                service.updateEntryWithDetails(created.getId(),
                        ledgerRequest("Updated adventure", 2, 2, "70.00", 3,
                                activity.getId(), "Updated downtime", award.getId(), "Updated award"), USER_ID));

        AdventureEntry persisted = entryMapper.findById(updated.getId());
        assertEquals("Updated adventure", persisted.getAdventureName());
        assertEquals(3, persisted.getEndingLevel());
        assertEquals("Updated downtime",
                activityMapper.findByEntryIdOrderByCreatedAtAsc(updated.getId()).get(0).getDescription());
        assertEquals("Updated award", awardMapper.findByAdventureEntryId(updated.getId()).get(0).getAwardName());
        assertCharacterState(characterMapper.findById(character.getId()),
                "Fighter1", "Fighter3", "70.00", 3, 0);

        transaction.executeWithoutResult(status -> service.deleteEntry(updated.getId(), USER_ID));

        assertNull(entryMapper.findById(updated.getId()));
        assertTrue(activityMapper.findByEntryIdOrderByCreatedAtAsc(updated.getId()).isEmpty());
        assertTrue(awardMapper.findByAdventureEntryId(updated.getId()).isEmpty());
        assertCharacterState(characterMapper.findById(character.getId()),
                "Fighter1", "Fighter1", "0.00", 0, 0);
    }

    @Test
    void consistencyReportIsReadOnly() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            int charactersBefore = queryInt(connection, "SELECT COUNT(*) FROM \"character\"", null);
            int entriesBefore = queryInt(connection, "SELECT COUNT(*) FROM adventure_entry", null);
            int inventoryBefore = queryInt(connection, "SELECT COUNT(*) FROM inventory_item", null);

            ScriptUtils.executeSqlScript(connection,
                    new ClassPathResource("db/diagnostics/delta_ledger_consistency_check.sql"));

            assertEquals(charactersBefore, queryInt(connection, "SELECT COUNT(*) FROM \"character\"", null));
            assertEquals(entriesBefore, queryInt(connection, "SELECT COUNT(*) FROM adventure_entry", null));
            assertEquals(inventoryBefore, queryInt(connection, "SELECT COUNT(*) FROM inventory_item", null));
            assertTrue(queryInt(connection,
                    "SELECT COUNT(*) FROM inventory_item WHERE acquisition_source IS NULL", null) > 0);
        }
    }

    private static Character newCharacter() {
        Character character = new Character();
        character.setId(UUID.randomUUID());
        character.setUserId(USER_ID);
        character.setCharacterName("Persistence Test");
        character.setRace("Human");
        character.setInitialClassesString("Fighter1");
        character.setCurrentClassesString("Fighter1");
        character.setCurrentGold(BigDecimal.ZERO);
        character.setCurrentDowntime(0);
        character.setCurrentMagicItems(0);
        character.setSoulCoins(0);
        return character;
    }

    private static void executeUpdate(Connection connection, String sql, UUID id, UUID userId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            statement.setObject(2, userId);
            statement.executeUpdate();
        }
    }

    private static AdventureEntrySaveRequest ledgerRequest(
            String name,
            int levelChange,
            int classLevelChange,
            String goldChange,
            int downtimeChange,
            UUID activityId,
            String activityDescription,
            UUID awardId,
            String awardName) {
        AdventureEntryRequest entry = new AdventureEntryRequest();
        entry.setAdventureName(name);
        entry.setPlayDate(LocalDate.of(2026, 9, 19));
        entry.setLevelChange(levelChange);
        ClassLevelChangeRequest classChange = new ClassLevelChangeRequest();
        classChange.setClassName("Fighter");
        classChange.setLevelChange(classLevelChange);
        entry.setClassChanges(List.of(classChange));
        entry.setGoldChange(new BigDecimal(goldChange));
        entry.setGoldDowntimeChange(BigDecimal.ZERO);
        entry.setDowntimeChange(downtimeChange);
        entry.setDowntimeDowntimeChange(0);
        entry.setMagicItemsChange(0);
        entry.setMagicItemsDowntimeChange(0);

        DowntimeActivityRequest activity = new DowntimeActivityRequest();
        activity.setId(activityId);
        activity.setDescription(activityDescription);
        StoryAwardRequest award = new StoryAwardRequest();
        award.setId(awardId);
        award.setAwardName(awardName);

        AdventureEntrySaveRequest request = new AdventureEntrySaveRequest();
        request.setEntry(entry);
        request.setDowntimeActivities(List.of(activity));
        request.setGainedItems(List.of());
        request.setStoryAwards(List.of(award));
        return request;
    }

    private static AdventureGainedItem gainedItem(
            UUID entryId, AcquisitionSource source, boolean needsDetails) {
        AdventureGainedItem item = new AdventureGainedItem();
        item.setId(UUID.randomUUID());
        item.setAdventureEntryId(entryId);
        item.setItemName("Snapshot " + item.getId());
        item.setItemType("PERMANENT");
        item.setQuantity(1);
        item.setAcquisitionSource(source);
        item.setNeedsDetails(needsDetails);
        return item;
    }

    private static AdventureEntry entry(UUID id, UUID characterId, LocalDate playDate, String name) {
        AdventureEntry entry = new AdventureEntry();
        entry.setId(id);
        entry.setCharacterId(characterId);
        entry.setPlayDate(playDate);
        entry.setAdventureName(name);
        entry.setRecordingModelVersion(2);
        return entry;
    }

    private static InventoryItem inventoryItem(
            UUID characterId, AcquisitionSource source, boolean needsDetails) {
        InventoryItem item = new InventoryItem();
        item.setId(UUID.randomUUID());
        item.setCharacterId(characterId);
        item.setItemName("Inventory " + item.getId());
        item.setItemType(InventoryItem.ItemType.PERMANENT);
        item.setQuantity(1);
        item.setAcquisitionSource(source);
        item.setNeedsDetails(needsDetails);
        return item;
    }

    private static void assertCharacterState(
            Character character,
            String initialClasses,
            String currentClasses,
            String currentGold,
            int currentDowntime,
            int currentMagicItems) {
        assertEquals(initialClasses, character.getInitialClassesString());
        assertEquals(currentClasses, character.getCurrentClassesString());
        assertEquals(0, character.getCurrentGold().compareTo(new BigDecimal(currentGold)));
        assertEquals(currentDowntime, character.getCurrentDowntime());
        assertEquals(currentMagicItems, character.getCurrentMagicItems());
    }

    private static void insertLegacyFixtures() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement user = connection.prepareStatement("""
                    INSERT INTO users (id, email, password_hash, display_name, is_active)
                    VALUES (?, 'ledger-test@example.invalid', NULL, 'Ledger test user', TRUE)
                    """)) {
                user.setObject(1, USER_ID);
                user.executeUpdate();
            }
            executeUpdate(connection, """
                    INSERT INTO user_oauth_accounts (id, user_id, provider, provider_user_id, email)
                    VALUES (?, ?, 'GOOGLE', 'test-only-google-id', 'ledger-test@example.invalid')
                    """, UUID.randomUUID(), USER_ID);
            try (PreparedStatement character = connection.prepareStatement("""
                    INSERT INTO "character" (
                        id, user_id, character_name, race, current_classes_string,
                        current_gold, current_downtime, current_magic_items
                    ) VALUES (?, ?, 'Legacy Hero', 'Human', '戰士 (Fighter)5', 10.50, 3, 1)
                    """)) {
                character.setObject(1, LEGACY_CHARACTER_ID);
                character.setObject(2, USER_ID);
                character.executeUpdate();
            }
            try (PreparedStatement entry = connection.prepareStatement("""
                    INSERT INTO adventure_entry (
                        id, character_id, adventure_name, play_date,
                        starting_classes_string, ending_classes_string
                    ) VALUES (?, ?, 'Legacy Adventure', DATE '2026-09-01',
                        '戰士 (Fighter)1', '戰士 (Fighter)5')
                    """)) {
                entry.setObject(1, LEGACY_ENTRY_ID);
                entry.setObject(2, LEGACY_CHARACTER_ID);
                entry.executeUpdate();
            }
            try (PreparedStatement gained = connection.prepareStatement("""
                    INSERT INTO adventure_gained_item (
                        id, adventure_entry_id, item_name, item_type, quantity
                    ) VALUES (?, ?, 'Legacy Sword', 'PERMANENT', 1)
                    """)) {
                gained.setObject(1, LEGACY_GAINED_ID);
                gained.setObject(2, LEGACY_ENTRY_ID);
                gained.executeUpdate();
            }
            try (PreparedStatement linked = connection.prepareStatement("""
                    INSERT INTO inventory_item (
                        id, character_id, adventure_entry_id, adventure_gained_item_id,
                        item_name, item_type, quantity
                    ) VALUES (?, ?, ?, ?, 'Legacy Sword', 'PERMANENT', 1)
                    """)) {
                linked.setObject(1, LEGACY_LINKED_INVENTORY_ID);
                linked.setObject(2, LEGACY_CHARACTER_ID);
                linked.setObject(3, LEGACY_ENTRY_ID);
                linked.setObject(4, LEGACY_GAINED_ID);
                linked.executeUpdate();
            }
            try (PreparedStatement manual = connection.prepareStatement("""
                    INSERT INTO inventory_item (
                        id, character_id, item_name, item_type, quantity
                    ) VALUES (?, ?, 'Manual Item', 'PERMANENT', 1)
                    """)) {
                manual.setObject(1, LEGACY_MANUAL_INVENTORY_ID);
                manual.setObject(2, LEGACY_CHARACTER_ID);
                manual.executeUpdate();
            }
            connection.commit();
        }
    }

    private static SqlSessionFactory buildSqlSessionFactory(DataSource source) throws Exception {
        Configuration configuration = new Configuration(
                new Environment("embedded-postgres", new SpringManagedTransactionFactory(), source));
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.getTypeHandlerRegistry()
                .register(UUID.class, JdbcType.OTHER, ObjectTypeHandler.class);
        for (String resource : List.of(
                "mapper/CharacterMapper.xml",
                "mapper/AdventureEntryMapper.xml",
                "mapper/AdventureGainedItemMapper.xml",
                "mapper/InventoryItemMapper.xml",
                "mapper/DowntimeActivityMapper.xml",
                "mapper/StoryAwardMapper.xml")) {
            try (InputStream input = LedgerPersistenceIntegrationTest.class
                    .getClassLoader().getResourceAsStream(resource)) {
                if (input == null) {
                    throw new IllegalStateException("Missing mapper resource: " + resource);
                }
                new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
            }
        }
        return new SqlSessionFactoryBuilder().build(configuration);
    }

    private static String queryString(Connection connection, String sql, UUID id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getString(1);
            }
        }
    }

    private static int queryInt(Connection connection, String sql, UUID id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            if (id != null) {
                statement.setObject(1, id);
            }
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private static boolean queryBoolean(Connection connection, String sql, UUID id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }
}
