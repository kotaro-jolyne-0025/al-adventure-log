package com.dndadvlog.backend.dto;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdventureEntryRequestTest {

    @Test
    void rejectsClientSuppliedSnapshotFields() {
        ObjectMapper mapper = new ObjectMapper();

        assertThrows(JsonMappingException.class, () -> mapper.readValue(
                "{\"startingLevel\":5,\"levelChange\":1}",
                AdventureEntryRequest.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue(
                "{\"goldTotal\":100}",
                AdventureEntryRequest.class));
    }

    @Test
    void rejectsNegativeOrInconsistentLevelChanges() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            AdventureEntryRequest request = new AdventureEntryRequest();
            request.setLevelChange(-1);
            assertTrue(validator.validate(request).stream()
                    .anyMatch(error -> error.getMessage().contains("不得為負數")));

            request.setLevelChange(2);
            ClassLevelChangeRequest classChange = new ClassLevelChangeRequest();
            classChange.setClassName("戰士 (Fighter)");
            classChange.setLevelChange(1);
            request.setClassChanges(List.of(classChange));
            assertTrue(validator.validate(request).stream()
                    .anyMatch(error -> error.getMessage().contains("合計")));
        }
    }
}
