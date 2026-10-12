package com.dndadvlog.backend.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SoulCoinMarkerTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void markerKeepsItsExactApiNameAcrossInventoryAndLootDtos() throws Exception {
        InventoryItemRequest inventory = json.readValue("{\"isSoulCoin\":true}", InventoryItemRequest.class);
        AdventureGainedItemRequest loot = json.readValue("{\"isSoulCoin\":false}", AdventureGainedItemRequest.class);
        assertTrue(inventory.getIsSoulCoin());
        assertFalse(loot.getIsSoulCoin());
        InventoryItemResponse response = new InventoryItemResponse();
        response.setIsSoulCoin(true);
        var tree = json.valueToTree(response);
        assertTrue(tree.get("isSoulCoin").asBoolean());
        assertFalse(tree.has("soulCoin"));
        AdventureGainedItemResponse snapshot = new AdventureGainedItemResponse();
        snapshot.setIsSoulCoin(false);
        assertFalse(json.valueToTree(snapshot).get("isSoulCoin").asBoolean());
    }
}
