package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.service.InventoryMovementService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InventoryMovementControllerTest {
    @Test void acceptsExplicitBooleanStatesAndRejectsMalformedFilters() {
        var service=mock(InventoryMovementService.class);
        var controller=new InventoryMovementController(service);
        UUID character=UUID.randomUUID(), entry=UUID.randomUUID(), user=UUID.randomUUID();
        var principal=UserPrincipal.builder().id(user).build();
        for(String invalid:List.of("", "yes", "1", "TRUE")) {
            var error=assertThrows(ResponseStatusException.class,()->controller.page(character,null,50,entry.toString(),invalid,principal));
            assertEquals(400,error.getStatusCode().value());
        }
        for(String invalid:List.of("", "invalid", "1-1-1-1-1")) {
            assertThrows(ResponseStatusException.class,()->controller.page(character,null,50,invalid,null,principal));
        }
        verifyNoInteractions(service);
        controller.page(character,null,50,null,null,principal);
        verify(service).page(character,user,null,50,null,null);
        for(boolean state:List.of(false,true)) {
            controller.page(character,"cursor",2,entry.toString(),String.valueOf(state),principal);
            verify(service).page(character,user,"cursor",2,entry,state);
        }
    }
}
