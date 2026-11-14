package com.dndadvlog.backend.config;

import com.dndadvlog.backend.BackendApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;

/** Test-scope launcher: the database exists only for this process and is discarded on exit. */
public final class LocalDevLauncher {
    private static final ConfigurableApplicationContext[] contextRef = new ConfigurableApplicationContext[1];

    private LocalDevLauncher() { }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("本機啟動器不接受額外的 Spring 設定參數。");
        EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
        String jdbcUrl = postgres.getJdbcUrl("postgres", "postgres");
        ManagedDevelopmentDatabase.authorize(jdbcUrl);
        byte[] key = new byte[48];
        new SecureRandom().nextBytes(key);
        String jwtSecret = Base64.getEncoder().encodeToString(key);
        AtomicBoolean closed = new AtomicBoolean();
        Runnable shutdown = () -> {
            if (!closed.compareAndSet(false, true)) return;
            try {
                if (contextRef[0] != null) contextRef[0].close();
            } finally {
                try { postgres.close(); } catch (Exception ignored) { }
            }
        };
        Runtime.getRuntime().addShutdownHook(new Thread(shutdown, "local-dev-shutdown"));
        try {
            contextRef[0] = new SpringApplication(BackendApplication.class).run(
                    "--spring.profiles.active=dev",
                    "--spring.datasource.url=" + jdbcUrl,
                    "--spring.datasource.username=postgres",
                    "--spring.datasource.password=postgres",
                    "--app.jwt.secret=" + jwtSecret,
                    "--server.port=8080",
                    "--cors.allowed-origin=http://localhost:4200");
            seedSyntheticData(contextRef[0]);
            System.out.println("Local dev login: local@local.test / test. Seeded 4 adventures, 8 permanent items, and 7 consumables. Data is temporary and recreated on restart.");
            Thread.currentThread().join();
        } finally {
            shutdown.run();
        }
    }

    private static void seedSyntheticData(ConfigurableApplicationContext context) {
        JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
        jdbc.update("""
                INSERT INTO users (email, password_hash, display_name, is_active)
                VALUES (?, ?, ?, TRUE)
                ON CONFLICT (email) DO NOTHING
                """, "local@local.test", new BCryptPasswordEncoder().encode("test"), "local");
        var userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", java.util.UUID.class,
                "local@local.test");
        jdbc.update("""
                INSERT INTO "character" (user_id, character_name, player_name, race,
                                         initial_classes_string, current_classes_string)
                VALUES (?, '暫存測試角色', '本機測試冒險者', 'Human', 'Fighter1', 'Fighter1')
                """, userId);
        var characterId = jdbc.queryForObject("SELECT id FROM \"character\" WHERE user_id = ? LIMIT 1",
                java.util.UUID.class, userId);
        var adventures = java.util.List.of(
                insertAdventure(jdbc, characterId, "The Goblin Market", "LOCAL-01", 0, 0, 1, 1),
                insertAdventure(jdbc, characterId, "Ruins of the Moon", "LOCAL-02", 1, 1, 2, 3),
                insertAdventure(jdbc, characterId, "The Sunken Archive", "LOCAL-03", 3, 3, 3, 6),
                insertAdventure(jdbc, characterId, "A Dragon's Bargain", "LOCAL-04", 6, 6, 2, 8));
        seedSampleInventory(jdbc, characterId, adventures);
    }

    private static java.util.UUID insertAdventure(JdbcTemplate jdbc, java.util.UUID characterId,
                                                   String name, String code, int daysAgo,
                                                   int startingMagicItems, int gainedMagicItems,
                                                   int endingMagicItems) {
        return jdbc.queryForObject("""
                INSERT INTO adventure_entry (character_id, adventure_code, adventure_name, play_date,
                    dm_name, starting_level, ending_level, starting_classes_string, ending_classes_string,
                    starting_magic_items, magic_items_change, magic_items_total, recording_model_version)
                VALUES (?, ?, ?, CURRENT_DATE - ?, 'Local DM', 1, 2, 'Fighter1', 'Fighter2', ?, ?, ?, 1)
                RETURNING id
                """, java.util.UUID.class, characterId, code, name, daysAgo,
                startingMagicItems, gainedMagicItems, endingMagicItems);
    }

    private static void seedSampleInventory(JdbcTemplate jdbc, java.util.UUID characterId,
                                            java.util.List<java.util.UUID> adventures) {
        addInventoryItem(jdbc, characterId, adventures.get(0), "Bag of Holding", "PERMANENT",
                "UNCOMMON", 1, "WONDROUS_ITEM", "Adventure reward; edit the name or notes.");
        addInventoryItem(jdbc, characterId, adventures.get(1), "+1 Shield", "PERMANENT",
                "UNCOMMON", 1, "ARMOR", "A sturdy shield from the Moon Ruins.");
        addInventoryItem(jdbc, characterId, adventures.get(1), "Cloak of Elvenkind", "PERMANENT",
                "UNCOMMON", 1, "WONDROUS_ITEM", "Its hood blends into the shadows.");
        addInventoryItem(jdbc, characterId, adventures.get(2), "Ring of Protection", "PERMANENT",
                "RARE", 1, "RING", "A silver ring marked with a tiny sun.");
        addInventoryItem(jdbc, characterId, adventures.get(2), "Sword +1", "PERMANENT",
                "UNCOMMON", 1, "WEAPON", "A balanced blade with a blue sheen.");
        addInventoryItem(jdbc, characterId, adventures.get(2), "Boots of Speed", "PERMANENT",
                "RARE", 1, "WONDROUS_ITEM", "The boots leave faint sparks when running.");
        addInventoryItem(jdbc, characterId, adventures.get(3), "Amulet of Health", "PERMANENT",
                "RARE", 1, "WONDROUS_ITEM", "A warm copper amulet.");
        addInventoryItem(jdbc, characterId, adventures.get(3), "Wand of the War Mage +1", "PERMANENT",
                "UNCOMMON", 1, "WAND", "A carved wand used in battle.");

        addInventoryItem(jdbc, characterId, adventures.get(0), "Healing Potion", "CONSUMABLE",
                "COMMON", 4, "POTION", "A stack of four potions for testing quantity edits.");
        addInventoryItem(jdbc, characterId, null, "Potion of Climbing", "CONSUMABLE",
                "COMMON", 2, "POTION", "A standalone stack for testing inventory edits.");
        addInventoryItem(jdbc, characterId, adventures.get(1), "Potion of Greater Healing", "CONSUMABLE",
                "UNCOMMON", 3, "POTION", "Restores a greater amount of health.");
        addInventoryItem(jdbc, characterId, null, "Antitoxin", "CONSUMABLE",
                "COMMON", 2, "POTION", "Helps resist poison for one hour.");
        addInventoryItem(jdbc, characterId, adventures.get(2), "Scroll of Protection", "CONSUMABLE",
                "UNCOMMON", 1, "SCROLL", "A single-use warding scroll.");
        addInventoryItem(jdbc, characterId, adventures.get(3), "Potion of Invisibility", "CONSUMABLE",
                "VERY_RARE", 1, "POTION", "The drinker becomes invisible briefly.");
        addInventoryItem(jdbc, characterId, null, "Potion of Water Breathing", "CONSUMABLE",
                "UNCOMMON", 2, "POTION", "Useful for exploring the Sunken Archive.");
        jdbc.update("UPDATE \"character\" SET current_magic_items = 8 WHERE id = ?", characterId);
    }

    private static void addInventoryItem(JdbcTemplate jdbc, java.util.UUID characterId,
                                         java.util.UUID adventureId, String name, String type,
                                         String rarity, int quantity, String category, String notes) {
        java.util.UUID gainedId = null;
        if (adventureId != null) {
            gainedId = java.util.UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO adventure_gained_item (id, adventure_entry_id, item_name, item_type, rarity,
                        quantity, notes, acquisition_source, needs_details, item_category, requires_attunement,
                        is_soul_coin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ADVENTURE', FALSE, ?, FALSE, FALSE)
                    """, gainedId, adventureId, name, type, rarity, quantity, notes, category);
        }
        var itemId = java.util.UUID.randomUUID();
        jdbc.update("""
                INSERT INTO inventory_item (id, character_id, adventure_entry_id, adventure_gained_item_id,
                    item_name, item_type, rarity, quantity, source, notes, acquisition_source, needs_details,
                    item_category, requires_attunement, is_soul_coin)
                VALUES (?, ?, ?, ?, ?, ?::item_type, ?::item_rarity, ?, ?, ?, ?, FALSE, ?, FALSE, FALSE)
                """, itemId, characterId, adventureId, gainedId, name, type, rarity, quantity,
                adventureId == null ? "Downtime" : "Adventure reward", notes,
                adventureId == null ? "DOWNTIME" : "ADVENTURE", category);
        jdbc.update("""
                INSERT INTO inventory_movement (id, character_id, item_id, item_name, item_type,
                    operation, reason, quantity_before, quantity_delta, quantity_after,
                    source_entry_id, source_gained_item_id, source_name, source_code)
                VALUES (?, ?, ?, ?, ?, 'BASELINE', 'BASELINE', 0, ?, ?, ?, ?, ?, ?)
                """, java.util.UUID.randomUUID(), characterId, itemId, name, type, quantity, quantity,
                adventureId, gainedId, adventureId == null ? null : "Local Adventure",
                adventureId == null ? null : "LOCAL");
    }
}
