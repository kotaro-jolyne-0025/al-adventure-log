package com.dndadvlog.backend.persistence;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.InventoryItem;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.exception.ResourceNotFoundException;
import com.dndadvlog.backend.mapper.*;
import com.dndadvlog.backend.service.*;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real isolated PostgreSQL, MyBatis, transaction proxies and migrations. */
class InventoryMovementIntegrationTest {
    @Configuration @EnableTransactionManagement static class Transactions {}
    static EmbeddedPostgres postgres;
    static AnnotationConfigApplicationContext context;
    static JdbcTemplate jdbc;
    static InventoryMovementService movements;
    static InventoryItemService stock;
    static AdventureEntryService adventures;
    static MutationGuard guard;
    static UUID baselineItem;
    UUID user, character, item, entry;

    @BeforeAll static void database() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        var source = postgres.getPostgresDatabase();
        Flyway.configure().dataSource(source).locations("classpath:db/migration").target("30").load().migrate();
        jdbc = new JdbcTemplate(source);
        UUID u=UUID.randomUUID(), c=UUID.randomUUID(); baselineItem=UUID.randomUUID();
        insertOwner(u,c);
        jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity) VALUES (?,?,'Baseline','CONSUMABLE',5)",baselineItem,c);
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        var template = new SqlSessionTemplate(LedgerPersistenceIntegrationTest.buildSqlSessionFactory(source));
        context = new AnnotationConfigApplicationContext();
        context.register(Transactions.class);
        context.registerBean("transactionManager",DataSourceTransactionManager.class,()->new DataSourceTransactionManager(source));
        context.registerBean(MutationGuard.class,()->new MutationGuard(jdbc));
        var inventory=template.getMapper(InventoryItemMapper.class);
        var entries=template.getMapper(AdventureEntryMapper.class);
        var characters=template.getMapper(CharacterMapper.class);
        var gained=template.getMapper(AdventureGainedItemMapper.class);
        context.registerBean(CharacterService.class,()->new CharacterService(characters,entries,inventory));
        context.registerBean(InventoryMovementService.class,()->new InventoryMovementService(
            template.getMapper(InventoryMovementMapper.class),inventory,entries,context.getBean(CharacterService.class),context.getBean(MutationGuard.class)));
        context.registerBean(InventoryItemService.class,()->new InventoryItemService(inventory,context.getBean(CharacterService.class),entries,gained,characters,context.getBean(InventoryMovementService.class)));
        context.registerBean(AdventureEntryService.class,()->new AdventureEntryService(entries,characters,template.getMapper(DowntimeActivityMapper.class),gained,
            template.getMapper(StoryAwardMapper.class),context.getBean(CharacterService.class),inventory,context.getBean(InventoryMovementService.class)));
        context.refresh();
        movements=context.getBean(InventoryMovementService.class); stock=context.getBean(InventoryItemService.class);
        guard=context.getBean(MutationGuard.class); adventures=context.getBean(AdventureEntryService.class);
    }

    static void insertOwner(UUID u, UUID c) {
        jdbc.update("INSERT INTO users(id,email,display_name) VALUES (?,?,'Fixture')",u,u+"@example.invalid");
        jdbc.update("INSERT INTO \"character\"(id,user_id,character_name,race,initial_classes_string,current_classes_string) VALUES (?,?,'Hero','Human','Fighter1','Fighter1')",c,u);
    }

    @BeforeEach void fixture() {
        user=UUID.randomUUID(); character=UUID.randomUUID(); insertOwner(user,character);
        InventoryItemRequest req=new InventoryItemRequest(); req.setItemName("Potion");req.setItemType(InventoryItem.ItemType.CONSUMABLE);req.setQuantity(5);
        item=guard.createItem(character,user,()->stock.createItem(character,req,user)).getId();
        entry=UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_entry(id,character_id,adventure_name,adventure_code) VALUES (?,?,'Usage','USE-1')",entry,character);
    }

    @AfterAll static void close() throws Exception { if(context!=null)context.close(); if(postgres!=null)postgres.close(); }
    String time(String table, UUID id) { return jdbc.queryForObject("SELECT updated_at FROM "+table+" WHERE id=?",Timestamp.class,id).toLocalDateTime().toString(); }
    int quantity(){ return jdbc.queryForObject("SELECT quantity FROM inventory_item WHERE id=?",Integer.class,item); }
    InventoryMovementResponse latest(){return movements.page(character,user,null,50).items().get(0);}
    InventoryConsumeRequest consumeRequest(int n){return new InventoryConsumeRequest(BigDecimal.valueOf(n),"Used",null);}
    void consume(int n){movements.consume(character,item,user,time("inventory_item",item),consumeRequest(n));}

    @Test void consumeAssociateClearReverseAndDeletePreserveHistory() {
        consume(5);assertEquals(0,quantity());
        var m=latest();assertTrue(m.isReversible());assertEquals(-5,m.getQuantityDelta());
        var request=new InventoryUsageRequest();request.setUsageAdventureEntryId(entry);
        m=movements.updateUsage(character,m.getId(),user,m.getUpdatedAt().toString(),request);
        assertEquals(entry,m.getUsageEntryId());assertEquals(0,quantity());
        request.setUsageAdventureEntryId(null);
        m=movements.updateUsage(character,m.getId(),user,m.getUpdatedAt().toString(),request);
        assertNull(m.getUsageOriginalEntryId());
        String expected=m.getUpdatedAt().toString(); UUID id=m.getId();
        assertTrue(movements.reverse(character,id,user,expected).isReversed());assertEquals(5,quantity());
        assertThrows(ResponseStatusException.class,()->movements.reverse(character,id,user,expected));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE reversal_of=?",Integer.class,id));
        guard.mutate(MutationGuard.Resource.ITEM,item,user,time("inventory_item",item),()->{stock.deleteItem(character,item,user);return null;});
        assertEquals("REMOVE",latest().getOperation());assertEquals(2,movements.page(character,user,null,50).items().size());
        guard.mutate(MutationGuard.Resource.CHARACTER,character,user,time("\"character\"",character),()->{jdbc.update("DELETE FROM \"character\" WHERE id=?",character);return null;});
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE character_id=?",Integer.class,character));
    }

    @Test void editsTheSameConsumptionNotesWithoutChangingStockHistoryOrCreationTime() {
        consume(1);var original=latest();String stockTime=time("inventory_item",item);
        var legacy=new InventoryUsageRequest();legacy.setUsageAdventureEntryId(entry);
        var associated=movements.updateUsage(character,original.getId(),user,original.getUpdatedAt().toString(),legacy);
        assertEquals("Used",associated.getNotes());
        var request=new InventoryUsageRequest();request.setUsageAdventureEntryId(entry);request.setNotes("Edited note\nSecond line");
        var edited=movements.updateUsage(character,original.getId(),user,associated.getUpdatedAt().toString(),request);
        assertEquals("Edited note\nSecond line",edited.getNotes());assertEquals(original.getCreatedAt(),edited.getCreatedAt());
        assertEquals(original.getId(),edited.getId());assertEquals(original.getQuantityDelta(),edited.getQuantityDelta());
        assertEquals(original.getSourceEntryId(),edited.getSourceEntryId());assertTrue(edited.isReversible());
        assertEquals(edited.getNotes(),movements.page(character,user,null,50,entry,false).items().get(0).getNotes());
        assertThrows(ResponseStatusException.class,()->movements.updateUsage(character,original.getId(),user,associated.getUpdatedAt().toString(),request));
        request.setNotes("");
        var cleared=movements.updateUsage(character,original.getId(),user,edited.getUpdatedAt().toString(),request);assertEquals("",cleared.getNotes());
        request.setNotes("x".repeat(2000));
        var max=movements.updateUsage(character,original.getId(),user,cleared.getUpdatedAt().toString(),request);assertEquals(2000,max.getNotes().length());
        request.setNotes(null);
        var nullClear=movements.updateUsage(character,original.getId(),user,max.getUpdatedAt().toString(),request);assertNull(nullClear.getNotes());
        assertEquals(4,quantity());assertEquals(stockTime,time("inventory_item",item));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE character_id=?",Integer.class,character));
    }

    @Test void notesOnlyUpdatesPreserveLiveAndDeletedUsageContext() {
        movements.consume(character,item,user,time("inventory_item",item),new InventoryConsumeRequest(BigDecimal.ONE,"Original note",entry));
        var original=latest();var request=new InventoryUsageRequest();request.setNotes("New note");
        var live=movements.updateUsage(character,original.getId(),user,original.getUpdatedAt().toString(),request);
        assertEquals(entry,live.getUsageEntryId());assertEquals(entry,live.getUsageOriginalEntryId());
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->{adventures.deleteEntry(entry,user);return null;});
        var deleted=latest();assertNull(deleted.getUsageEntryId());
        request.setNotes("After deletion");
        var edited=movements.updateUsage(character,deleted.getId(),user,deleted.getUpdatedAt().toString(),request);
        assertEquals(entry,edited.getUsageOriginalEntryId());assertNull(edited.getUsageEntryId());
        assertEquals("Usage",edited.getUsageName());assertEquals("After deletion",edited.getNotes());assertEquals(4,quantity());
    }

    @Test void noteEditsRejectOversizeForeignAndReversedWritesWithoutChangingExistingData() {
        consume(1);var original=latest();String expected=original.getUpdatedAt().toString();
        var request=new InventoryUsageRequest();request.setUsageAdventureEntryId(null);request.setNotes("x".repeat(2001));
        assertThrows(ResponseStatusException.class,()->movements.updateUsage(character,original.getId(),user,expected,request));
        request.setNotes("Rejected");
        assertThrows(ResourceNotFoundException.class,()->movements.updateUsage(character,original.getId(),UUID.randomUUID(),expected,request));
        assertEquals("Used",latest().getNotes());assertEquals(expected,latest().getUpdatedAt().toString());
        var reversed=movements.reverse(character,original.getId(),user,expected);
        assertThrows(ResponseStatusException.class,()->movements.updateUsage(character,original.getId(),user,reversed.getUpdatedAt().toString(),request));
        assertEquals("Used",jdbc.queryForObject("SELECT notes FROM inventory_movement WHERE id=?",String.class,original.getId()));
        assertEquals(5,quantity());
    }

    @Test void rejectsInvalidQuantitiesOwnershipAndMissingTokens() {
        for(String n: List.of("0","-1","1.5","6","999999999999999")) {
            assertThrows(BusinessException.class,()->movements.consume(character,item,user,time("inventory_item",item),new InventoryConsumeRequest(new BigDecimal(n),null,null)));
        }
        assertThrows(ResponseStatusException.class,()->movements.consume(character,item,user,null,consumeRequest(1)));
        UUID other=UUID.randomUUID();
        assertThrows(ResourceNotFoundException.class,()->movements.consume(other,item,user,time("inventory_item",item),consumeRequest(1)));
        assertThrows(ResourceNotFoundException.class,()->movements.page(character,other,null,50));
        assertEquals(5,quantity());assertEquals(1,movements.page(character,user,null,50).items().size());
        jdbc.update("UPDATE inventory_item SET item_type='PERMANENT' WHERE id=?",item);
        assertThrows(BusinessException.class,()->consume(1));
    }

    @Test void refusesEarlierReversalAndNeverReplenishesDeletedStock() {
        consume(1);var first=latest();consume(1);
        assertFalse(movements.page(character,user,null,50).items().stream().filter(m->m.getId().equals(first.getId())).findFirst().orElseThrow().isReversible());
        assertThrows(BusinessException.class,()->movements.reverse(character,first.getId(),user,first.getUpdatedAt().toString()));
        var last=latest();guard.mutate(MutationGuard.Resource.ITEM,item,user,time("inventory_item",item),()->{stock.deleteItem(character,item,user);return null;});
        assertThrows(BusinessException.class,()->movements.reverse(character,last.getId(),user,last.getUpdatedAt().toString()));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_item WHERE id=?",Integer.class,item));
    }

    @Test void usageDeletionRetainsSnapshotAndDoesNotUndoConsumption() {
        movements.consume(character,item,user,time("inventory_item",item),new InventoryConsumeRequest(BigDecimal.ONE,null,entry));
        var before=latest();
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->{adventures.deleteEntry(entry,user);return null;});
        var after=latest();assertEquals(before.getId(),after.getId());assertNull(after.getUsageEntryId());
        assertEquals(entry,after.getUsageOriginalEntryId());assertEquals("Usage",after.getUsageName());assertEquals(4,quantity());
        assertTrue(after.getUpdatedAt().isAfter(before.getUpdatedAt()));
    }

    @Test void sourceDeletionJournalsCascadeAndRetainsConsumption() {
        jdbc.update("UPDATE inventory_item SET adventure_entry_id=? WHERE id=?",entry,item);
        UUID usage=UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_entry(id,character_id) VALUES (?,?)",usage,character);
        movements.consume(character,item,user,time("inventory_item",item),new InventoryConsumeRequest(BigDecimal.ONE,null,usage));
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->{adventures.deleteEntry(entry,user);return null;});
        var rows=movements.page(character,user,null,50).items();assertEquals(3,rows.size());
        assertEquals("SOURCE_DELETE",rows.get(0).getReason());assertEquals(-4,rows.get(0).getQuantityDelta());
        assertEquals("CONSUME",rows.get(1).getOperation());assertEquals("Usage",rows.get(0).getSourceName());
        var scoped=movements.page(character,user,null,50,usage,false).items();
        assertEquals(1,scoped.size());assertEquals(rows.get(1).getId(),scoped.get(0).getId());
        assertEquals("Usage",scoped.get(0).getSourceName());assertFalse(scoped.get(0).isReversible());
    }

    @Test void sourceCorrectionsRecordActualDeltaAndNeverDuplicateOnResave() {
        var request=new AdventureGainedItemRequest();request.setItemName("Reward potion");request.setItemType("CONSUMABLE");request.setQuantity(5);
        var gained=guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.createGainedItem(entry,request,user));
        item=jdbc.queryForObject("SELECT id FROM inventory_item WHERE adventure_gained_item_id=?",UUID.class,gained.getId());
        consume(3);assertEquals(2,quantity());
        request.setQuantity(1);
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.updateGainedItem(entry,gained.getId(),request,user));
        var m=latest();assertEquals("SOURCE_CORRECTION",m.getReason());assertEquals(-2,m.getQuantityDelta());
        int count=movements.page(character,user,null,50).items().size();
        request.setNotes("Correction memo");
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.updateGainedItem(entry,gained.getId(),request,user));
        assertEquals(count,movements.page(character,user,null,50).items().size());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_item WHERE id=?",Integer.class,item));
        request.setQuantity(3);
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.updateGainedItem(entry,gained.getId(),request,user));
        item=jdbc.queryForObject("SELECT id FROM inventory_item WHERE adventure_gained_item_id=?",UUID.class,gained.getId());
        assertEquals(2,quantity());assertEquals(2,latest().getQuantityDelta());
    }

    @Test void typeChangesAndManualAdjustmentsHaveDistinctHistoryAndBlockReversal() {
        consume(1);var consumption=latest();
        var request=new InventoryItemRequest();request.setItemName("Renamed");request.setItemType(InventoryItem.ItemType.CONSUMABLE);request.setQuantity(4);
        guard.mutate(MutationGuard.Resource.ITEM,item,user,time("inventory_item",item),()->stock.updateItem(character,item,request,user));
        assertEquals(consumption.getId(),latest().getId());assertTrue(latest().isReversible());
        request.setItemType(InventoryItem.ItemType.PERMANENT);
        assertThrows(BusinessException.class,()->guard.mutate(MutationGuard.Resource.ITEM,item,user,time("inventory_item",item),()->stock.updateItem(character,item,request,user)));
        assertEquals(4,quantity());assertEquals(consumption.getId(),latest().getId());
        request.setItemType(InventoryItem.ItemType.CONSUMABLE);request.setQuantity(2);
        guard.mutate(MutationGuard.Resource.ITEM,item,user,time("inventory_item",item),()->stock.updateItem(character,item,request,user));
        assertEquals(-2,latest().getQuantityDelta());assertEquals("ADJUST",latest().getOperation());
        assertThrows(BusinessException.class,()->movements.reverse(character,consumption.getId(),user,consumption.getUpdatedAt().toString()));

        var permanentRequest=new InventoryItemRequest();permanentRequest.setItemName("Ring");permanentRequest.setItemType(InventoryItem.ItemType.PERMANENT);permanentRequest.setQuantity(1);
        var permanent=guard.createItem(character,user,()->stock.createItem(character,permanentRequest,user));
        permanentRequest.setItemType(InventoryItem.ItemType.CONSUMABLE);
        assertThrows(BusinessException.class,()->guard.mutate(MutationGuard.Resource.ITEM,permanent.getId(),user,time("inventory_item",permanent.getId()),()->stock.updateItem(character,permanent.getId(),permanentRequest,user)));
        assertEquals("PERMANENT",jdbc.queryForObject("SELECT item_type::text FROM inventory_item WHERE id=?",String.class,permanent.getId()));
        assertEquals("ACQUIRE",latest().getOperation());
    }

    @Test void sourceTypeMismatchRollsBackSnapshotAndWarehouseChanges() {
        var request=new AdventureGainedItemRequest();request.setItemName("Sword");request.setItemType("PERMANENT");request.setQuantity(1);
        var gained=guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.createGainedItem(entry,request,user));
        UUID warehouse=jdbc.queryForObject("SELECT id FROM inventory_item WHERE adventure_gained_item_id=?",UUID.class,gained.getId());
        // Simulate a legacy warehouse conversion that must not be restored as five permanent items.
        jdbc.update("UPDATE inventory_item SET item_type='CONSUMABLE',quantity=5 WHERE id=?",warehouse);
        String originalTime=time("adventure_entry",entry);
        var originalMovement=latest().getId();
        request.setItemName("Renamed sword");
        assertThrows(BusinessException.class,()->guard.mutate(MutationGuard.Resource.ENTRY,entry,user,originalTime,()->adventures.updateGainedItem(entry,gained.getId(),request,user)));
        assertEquals("Sword",jdbc.queryForObject("SELECT item_name FROM adventure_gained_item WHERE id=?",String.class,gained.getId()));
        assertEquals("CONSUMABLE",jdbc.queryForObject("SELECT item_type::text FROM inventory_item WHERE id=?",String.class,warehouse));
        assertEquals(5,jdbc.queryForObject("SELECT quantity FROM inventory_item WHERE id=?",Integer.class,warehouse));
        assertEquals(originalTime,time("adventure_entry",entry));
        assertEquals(originalMovement,latest().getId());
        request.setId(gained.getId());
        var save=new AdventureEntrySaveRequest();
        var entryRequest=new AdventureEntryRequest();entryRequest.setAdventureName("Changed parent");
        save.setEntry(entryRequest);save.setGainedItems(List.of(request));save.setDowntimeActivities(List.of());save.setStoryAwards(List.of());
        assertThrows(BusinessException.class,()->guard.mutate(MutationGuard.Resource.ENTRY,entry,user,originalTime,()->adventures.updateEntryWithDetails(entry,save,user)));
        assertEquals("Usage",jdbc.queryForObject("SELECT adventure_name FROM adventure_entry WHERE id=?",String.class,entry));
        assertEquals("Sword",jdbc.queryForObject("SELECT item_name FROM adventure_gained_item WHERE id=?",String.class,gained.getId()));
    }

    @Test void legacySnapshotBackfillCannotChangeWarehouseType() {
        UUID legacy=UUID.randomUUID();
        jdbc.update("INSERT INTO inventory_item(id,character_id,adventure_entry_id,item_name,item_type,quantity) VALUES (?,?,?,'Legacy','PERMANENT',1)",legacy,character,entry);
        var request=new AdventureGainedItemRequest();request.setItemName("Legacy");request.setItemType("CONSUMABLE");request.setQuantity(1);
        assertThrows(BusinessException.class,()->guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.updateGainedItem(entry,legacy,request,user)));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM adventure_gained_item WHERE id=?",Integer.class,legacy));
        assertEquals("PERMANENT",jdbc.queryForObject("SELECT item_type::text FROM inventory_item WHERE id=?",String.class,legacy));
    }

    @Test void sourceMetadataOnlyEditKeepsExhaustedStockReversible() {
        var request=new AdventureGainedItemRequest();request.setItemName("Reward");request.setItemType("CONSUMABLE");request.setQuantity(1);
        var gained=guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.createGainedItem(entry,request,user));
        item=jdbc.queryForObject("SELECT id FROM inventory_item WHERE adventure_gained_item_id=?",UUID.class,gained.getId());
        consume(1);var consumption=latest();
        request.setItemName("Corrected name");request.setNotes("Corrected note");
        guard.mutate(MutationGuard.Resource.ENTRY,entry,user,time("adventure_entry",entry),()->adventures.updateGainedItem(entry,gained.getId(),request,user));
        assertEquals(0,quantity());assertEquals(consumption.getId(),latest().getId());assertTrue(latest().isReversible());
        movements.reverse(character,consumption.getId(),user,consumption.getUpdatedAt().toString());assertEquals(1,quantity());
    }

    @Test void concurrentConsumptionAndSourceDeletionSerializeWithoutLostHistory() throws Exception {
        jdbc.update("UPDATE inventory_item SET adventure_entry_id=? WHERE id=?",entry,item);
        String itemTime=time("inventory_item",item),entryTime=time("adventure_entry",entry);
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            var consume=pool.submit(()->{start.await();try{movements.consume(character,item,user,itemTime,consumeRequest(1));return true;}
                catch(ResourceNotFoundException | ResponseStatusException e){return false;}});
            var delete=pool.submit(()->{start.await();try{guard.mutate(MutationGuard.Resource.ENTRY,entry,user,entryTime,()->{adventures.deleteEntry(entry,user);return null;});return true;}
                catch(ResponseStatusException e){assertEquals(409,e.getStatusCode().value());return false;}});
            start.countDown();assertNotEquals(consume.get(15,TimeUnit.SECONDS),delete.get(15,TimeUnit.SECONDS));
        } finally {pool.shutdownNow();}
        assertEquals(2,movements.page(character,user,null,50).items().size());
        var last=latest();
        if ("REMOVE".equals(last.getOperation())) assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_item WHERE id=?",Integer.class,item));
        else {assertEquals("CONSUME",last.getOperation());assertEquals(4,quantity());}
    }

    @Test void soulCoinTotalsFollowInventoryWhileRewardsAndGoldStayUnchanged() {
        jdbc.update("UPDATE inventory_item SET is_soul_coin=true WHERE id=?",item);
        var before=context.getBean(CharacterService.class).findCharacter(character,user);
        consume(2);
        var after=context.getBean(CharacterService.class).getCharacter(character,user);
        assertEquals(3,after.getSoulCoins());
        assertEquals(before.getCurrentGold(),after.getCurrentGold());
        assertEquals(before.getCurrentMagicItems(),after.getCurrentMagicItems());
    }

    @Test void anonymousRolesCannotReadMovementTableAndInvalidBaselineIsNotSilentlyFixed() throws Exception {
        jdbc.execute("CREATE ROLE movement_test_reader");
        try {
            assertFalse(jdbc.queryForObject("SELECT has_table_privilege('movement_test_reader','inventory_movement','SELECT')",Boolean.class));
            assertTrue(jdbc.queryForObject("SELECT relrowsecurity FROM pg_class WHERE oid='inventory_movement'::regclass",Boolean.class));
        } finally {jdbc.execute("DROP ROLE movement_test_reader");}
        var transaction=new org.springframework.transaction.support.TransactionTemplate(context.getBean(DataSourceTransactionManager.class));
        var sql=Files.readString(Path.of("src/main/resources/db/migration/V31__add_inventory_movements.sql"));
        assertThrows(RuntimeException.class,()->transaction.executeWithoutResult(status->{
            jdbc.update("INSERT INTO inventory_item(id,character_id,item_name,item_type,quantity) VALUES (gen_random_uuid(),?,'Invalid','CONSUMABLE',NULL)",character);
            jdbc.execute(sql);
        }));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_item WHERE character_id=? AND quantity IS NULL",Integer.class,character));
    }

    @Test void rollsBackQuantityTimestampAndHistoryOnRecordFailure() {
        String before=time("inventory_item",item);
        jdbc.execute("ALTER TABLE inventory_movement ADD CONSTRAINT reject_consumption_test CHECK (operation<>'CONSUME') NOT VALID");
        try {assertThrows(RuntimeException.class,()->consume(1));}
        finally {jdbc.execute("ALTER TABLE inventory_movement DROP CONSTRAINT reject_consumption_test");}
        assertEquals(5,quantity());assertEquals(before,time("inventory_item",item));assertEquals(1,movements.page(character,user,null,50).items().size());
    }

    @Test void reversalRejectsOverflowEvenIfAnOldWriterChangedStockWithoutHistory() {
        consume(1);var m=latest();
        jdbc.update("UPDATE inventory_item SET quantity=? WHERE id=?",Integer.MAX_VALUE,item);
        String before=time("inventory_item",item);
        assertThrows(BusinessException.class,()->movements.reverse(character,m.getId(),user,m.getUpdatedAt().toString()));
        assertEquals(Integer.MAX_VALUE,quantity());assertEquals(before,time("inventory_item",item));
        assertEquals(2,movements.page(character,user,null,50).items().size());
    }

    @Test void concurrentAndRetriedRequestsOnlyConsumeOnce() throws Exception {
        String expected=time("inventory_item",item);
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> call=()->{start.await();try{movements.consume(character,item,user,expected,consumeRequest(2));return true;}
                catch(ResponseStatusException e){assertEquals(409,e.getStatusCode().value());return false;}};
            var a=pool.submit(call);var b=pool.submit(call);start.countDown();
            assertNotEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
        } finally {pool.shutdownNow();}
        assertEquals(3,quantity());assertEquals(2,movements.page(character,user,null,50).items().size());
        assertThrows(ResponseStatusException.class,()->movements.consume(character,item,user,expected,consumeRequest(2)));
    }

    @Test void paginatesStablyAndRejectsInvalidCursorAndAssociation() {
        consume(1);var first=movements.page(character,user,null,1);consume(1);
        var second=movements.page(character,user,first.nextCursor(),1);
        assertNotEquals(first.items().get(0).getId(),second.items().get(0).getId());
        assertEquals("ACQUIRE",second.items().get(0).getOperation());
        assertThrows(ResponseStatusException.class,()->movements.page(character,user,"bad",50));
        assertThrows(ResponseStatusException.class,()->movements.page(character,user,null,101));
        var m=latest();var request=new InventoryUsageRequest();
        assertThrows(ResponseStatusException.class,()->movements.updateUsage(character,m.getId(),user,m.getUpdatedAt().toString(),request));
        request.setUsageAdventureEntryId(UUID.randomUUID());
        assertThrows(ResourceNotFoundException.class,()->movements.updateUsage(character,m.getId(),user,m.getUpdatedAt().toString(),request));
        assertEquals(3,quantity());
    }

    @Test void scopesBeforePaginationAndKeepsActiveAndReversedPagesSeparate() {
        Set<UUID> active=new HashSet<>(), reversed=new HashSet<>();
        for (int i=0;i<6;i++) {
            UUID id=UUID.randomUUID();
            jdbc.update("""
                INSERT INTO inventory_movement(id,character_id,item_id,item_name,item_type,operation,reason,
                    quantity_before,quantity_delta,quantity_after,source_entry_id,source_name,usage_entry_id,created_at)
                VALUES (?,?,?,'Potion','CONSUMABLE','CONSUME','MANUAL',1,-1,0,?,'Other source',?,'2020-01-01')
                """,id,character,UUID.randomUUID(),UUID.randomUUID(),entry);
            if(i<3) active.add(id);
            else {
                reversed.add(id);
                jdbc.update("""
                    INSERT INTO inventory_movement(id,character_id,item_id,item_name,item_type,operation,reason,
                        quantity_before,quantity_delta,quantity_after,reversal_of,usage_entry_id)
                    VALUES (?,?,?,'Potion','CONSUMABLE','REVERSE','MANUAL',0,1,1,?,?)
                    """,UUID.randomUUID(),character,UUID.randomUUID(),id,entry);
            }
        }
        jdbc.update("""
            INSERT INTO inventory_movement(id,character_id,item_id,item_name,item_type,operation,reason,
                quantity_before,quantity_delta,quantity_after,source_entry_id)
            SELECT gen_random_uuid(),?,gen_random_uuid(),'Noise','CONSUMABLE','ACQUIRE','MANUAL',0,1,1,?
            FROM generate_series(1,55)
            """,character,entry);
        assertTrue(movements.page(character,user,null,50).items().stream().noneMatch(m->"CONSUME".equals(m.getOperation())));
        for(boolean state:List.of(false,true)) {
            var first=movements.page(character,user,null,2,entry,state);
            assertEquals(2,first.items().size());assertNotNull(first.nextCursor());
            var second=movements.page(character,user,first.nextCursor(),2,entry,state);
            assertEquals(1,second.items().size());assertNull(second.nextCursor());
            Set<UUID> ids=new HashSet<>();
            for(var page:List.of(first,second)) for(var m:page.items()) {
                assertEquals("CONSUME",m.getOperation());assertEquals(state,m.isReversed());
                assertEquals(entry,m.getUsageEntryId());assertTrue(ids.add(m.getId()));
            }
            assertEquals(state?reversed:active,ids);
        }
    }

    @Test void defaultHistoryHidesReversedPairsBeforePaginationButRetainsTheirSafetyEvidence() {
        List<UUID> hidden=new ArrayList<>();
        for(int i=0;i<2;i++) {
            consume(1);var original=latest();hidden.add(original.getId());
            movements.reverse(character,original.getId(),user,original.getUpdatedAt().toString());
            assertThrows(ResponseStatusException.class,()->movements.reverse(character,original.getId(),user,original.getUpdatedAt().toString()));
        }
        assertEquals(5,quantity());
        consume(1);var active=latest();
        var first=movements.page(character,user,null,1);
        assertEquals(active.getId(),first.items().get(0).getId());assertNotNull(first.nextCursor());
        var second=movements.page(character,user,first.nextCursor(),1);
        assertEquals(1,second.items().size());assertEquals("ACQUIRE",second.items().get(0).getOperation());assertNull(second.nextCursor());
        var all=movements.page(character,user,null,100).items();
        assertEquals(2,all.size());assertTrue(all.stream().noneMatch(m->m.isReversed() || "REVERSE".equals(m.getOperation())));
        for(UUID id:hidden) {
            assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE id=?",Integer.class,id));
            assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE reversal_of=?",Integer.class,id));
        }
        assertEquals(4,quantity());assertEquals(6,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE character_id=?",Integer.class,character));
    }

    @Test void scopedReadsRejectInvalidFiltersAndForeignOrMissingAdventures() {
        assertThrows(ResponseStatusException.class,()->movements.page(character,user,null,50,null,false));
        assertThrows(ResponseStatusException.class,()->movements.page(character,user,null,50,entry,null));
        assertThrows(ResourceNotFoundException.class,()->movements.page(character,user,null,50,UUID.randomUUID(),false));
        UUID otherUser=UUID.randomUUID(), otherCharacter=UUID.randomUUID(), foreignEntry=UUID.randomUUID();
        insertOwner(otherUser,otherCharacter);
        jdbc.update("INSERT INTO adventure_entry(id,character_id) VALUES (?,?)",foreignEntry,otherCharacter);
        assertThrows(ResourceNotFoundException.class,()->movements.page(character,user,null,50,foreignEntry,false));
        jdbc.update("UPDATE \"character\" SET user_id=? WHERE id=?",user,otherCharacter);
        assertThrows(ResourceNotFoundException.class,()->movements.page(character,user,null,50,foreignEntry,false));
        assertThrows(ResourceNotFoundException.class,()->movements.page(character,otherUser,null,50,entry,false));
    }

    @Test void movingClearingAndReversingUsageUpdatesBothViewsWithoutAnotherConsumption() {
        UUID destination=UUID.randomUUID();
        jdbc.update("INSERT INTO adventure_entry(id,character_id,adventure_name) VALUES (?,?,'Destination')",destination,character);
        jdbc.update("UPDATE inventory_item SET adventure_entry_id=? WHERE id=?",entry,item);
        movements.consume(character,item,user,time("inventory_item",item),new InventoryConsumeRequest(BigDecimal.valueOf(5),null,entry));
        var original=latest();assertEquals(0,quantity());
        var request=new InventoryUsageRequest();request.setUsageAdventureEntryId(destination);
        var moved=movements.updateUsage(character,original.getId(),user,original.getUpdatedAt().toString(),request);
        assertEquals(original.getCreatedAt(),moved.getCreatedAt());assertEquals(original.getSourceEntryId(),moved.getSourceEntryId());
        assertTrue(movements.page(character,user,null,50,entry,false).items().isEmpty());
        assertEquals(original.getId(),movements.page(character,user,null,50,destination,false).items().get(0).getId());
        request.setUsageAdventureEntryId(null);
        var cleared=movements.updateUsage(character,moved.getId(),user,moved.getUpdatedAt().toString(),request);
        assertTrue(movements.page(character,user,null,50,destination,false).items().isEmpty());
        assertEquals(2,movements.page(character,user,null,50).items().size());assertEquals(0,quantity());
        request.setUsageAdventureEntryId(destination);
        var restored=movements.updateUsage(character,cleared.getId(),user,cleared.getUpdatedAt().toString(),request);
        movements.reverse(character,restored.getId(),user,restored.getUpdatedAt().toString());
        assertEquals(5,quantity());assertTrue(movements.page(character,user,null,50,destination,false).items().isEmpty());
        var history=movements.page(character,user,null,50,destination,true).items();
        assertEquals(1,history.size());assertEquals(original.getId(),history.get(0).getId());
        assertEquals(-5,history.get(0).getQuantityDelta());assertEquals(0,history.get(0).getQuantityAfter());
        assertEquals(1,movements.page(character,user,null,50).items().size());
    }

    @Test void baselinesStayStoredButAreExcludedBeforePagination() {
        jdbc.update("UPDATE inventory_movement SET operation='BASELINE' WHERE item_id=?",item);
        var empty=movements.page(character,user,null,1);
        assertTrue(empty.items().isEmpty());assertNull(empty.nextCursor());
        assertEquals(5,quantity());
        consume(1);var firstUse=latest();consume(1);var secondUse=latest();
        var first=movements.page(character,user,null,1);
        assertEquals(secondUse.getId(),first.items().get(0).getId());assertNotNull(first.nextCursor());
        var second=movements.page(character,user,first.nextCursor(),1);
        assertEquals(firstUse.getId(),second.items().get(0).getId());assertNull(second.nextCursor());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE item_id=? AND operation='BASELINE'",Integer.class,item));
        assertEquals(3,quantity());
    }

    @Test void baselineRerunPreservesStockAndDoesNotRecreateDeletedItems() throws Exception {
        var sql=Files.readString(Path.of("src/main/resources/db/migration/V31__add_inventory_movements.sql"));
        var transaction=new org.springframework.transaction.support.TransactionTemplate(context.getBean(DataSourceTransactionManager.class));
        transaction.executeWithoutResult(status->{jdbc.execute(sql);jdbc.execute(sql);});
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement WHERE item_id=? AND operation='BASELINE'",Integer.class,baselineItem));
        assertEquals(5,jdbc.queryForObject("SELECT quantity FROM inventory_item WHERE id=?",Integer.class,baselineItem));
        jdbc.update("DELETE FROM inventory_item WHERE id=?",baselineItem);
        transaction.executeWithoutResult(status->jdbc.execute(sql));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_item WHERE id=?",Integer.class,baselineItem));
    }
}
