package com.dndadvlog.backend.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AdventureEntrySaveRequestTest {
    @Test
    void requiresExplicitChildListsAndRejectsNullElements() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            AdventureEntrySaveRequest request = new AdventureEntrySaveRequest();
            request.setEntry(new AdventureEntryRequest());
            assertEquals(3, validator.validate(request).size());
            request.setDowntimeActivities(List.of());
            request.setGainedItems(List.of());
            request.setStoryAwards(List.of());
            assertTrue(validator.validate(request).isEmpty());
            request.setGainedItems(Arrays.asList((AdventureGainedItemRequest) null));
            assertFalse(validator.validate(request).isEmpty());
        }
    }
}
