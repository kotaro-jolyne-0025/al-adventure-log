package com.dndadvlog.backend.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class InventoryUsageRequestTest {
    @Test void requiresTheActualAssociationFieldIncludingExplicitNull() throws Exception {
        var json=new ObjectMapper();
        assertFalse(json.readValue("{}",InventoryUsageRequest.class).isSupplied());
        assertFalse(json.readValue("{\"supplied\":true}",InventoryUsageRequest.class).isSupplied());
        var clear=json.readValue("{\"usageAdventureEntryId\":null}",InventoryUsageRequest.class);
        assertTrue(clear.isSupplied());assertNull(clear.getUsageAdventureEntryId());
    }

    @Test void distinguishesOmittedNotesFromAnExplicitClearAndIgnoresSuppliedFlagSpoofing() throws Exception {
        var json=new ObjectMapper();
        assertFalse(json.readValue("{\"usageAdventureEntryId\":null}",InventoryUsageRequest.class).isNotesSupplied());
        assertFalse(json.readValue("{\"notesSupplied\":true}",InventoryUsageRequest.class).isNotesSupplied());
        var clear=json.readValue("{\"usageAdventureEntryId\":null,\"notes\":null}",InventoryUsageRequest.class);
        assertTrue(clear.isNotesSupplied());assertNull(clear.getNotes());
        assertEquals("memo",json.readValue("{\"notes\":\"memo\"}",InventoryUsageRequest.class).getNotes());
    }
}
