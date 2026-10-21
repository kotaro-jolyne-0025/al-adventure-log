package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.exception.*;
import com.dndadvlog.backend.service.*;
import org.junit.jupiter.api.*;
import org.springframework.http.ContentDisposition;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdventureExportControllerTest {
    private final AdventureExportReadService reads = mock(AdventureExportReadService.class);
    private final AdventurePdfWriter pdf = mock(AdventurePdfWriter.class);
    private final AdventureExcelWriter excel = mock(AdventureExcelWriter.class);
    private final UUID user = UUID.randomUUID();
    private final UUID character = UUID.randomUUID();
    private MockMvc http;
    @BeforeEach void setup() {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(UserPrincipal.builder().id(user).build(), "", List.of()));
        http = MockMvcBuilders.standaloneSetup(new AdventureExportController(reads, pdf, excel))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void validatesAuthenticationAndFormatsBeforeRead() throws Exception {
        http.perform(get(url())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        http.perform(get(url()).param("format", "csv")).andExpect(status().isBadRequest());
        http.perform(get("/api/characters/invalid/exports").param("format", "pdf")).andExpect(status().isBadRequest());
        SecurityContextHolder.clearContext();
        http.perform(get(url()).param("format", "pdf")).andExpect(status().isUnauthorized());
        verifyNoInteractions(reads, pdf, excel);
    }
    @Test void returnsJsonForMissingForeignOrEmptyCharacter() throws Exception {
        when(reads.read(character, user)).thenThrow(new ResourceNotFoundException("找不到角色"));
        http.perform(get(url()).param("format", "xlsx")).andExpect(status().isNotFound()).andExpect(header().doesNotExist("Content-Disposition"));
        doThrow(new BusinessException("尚無冒險紀錄可匯出")).when(reads).read(character, user);
        http.perform(get(url()).param("format", "pdf")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("尚無冒險紀錄可匯出"));
        verifyNoInteractions(pdf, excel);
    }
    @Test void returnsCompleteBytesWithSafeUtf8NameAndNoStore() throws Exception {
        var snapshot = AdventureExportWritersTest.sample(1); snapshot.character().setCharacterName("中文/角色\r\n\".pdf");
        when(reads.read(character, user)).thenReturn(snapshot);
        when(pdf.write(snapshot)).thenReturn(new byte[]{37, 80, 68, 70});
        var result = http.perform(get(url()).param("format", "pdf")).andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Cache-Control", "no-store, private")).andExpect(content().bytes(new byte[]{37, 80, 68, 70})).andReturn();
        String header = result.getResponse().getHeader("Content-Disposition");
        assertFalse(header.contains("\r")); assertFalse(header.contains("\n"));
        String filename = ContentDisposition.parse(header).getFilename();
        assertTrue(filename.startsWith("冒險紀錄_中文_角色")); assertFalse(filename.contains("/")); assertTrue(filename.endsWith(".pdf"));
        when(excel.write(snapshot)).thenReturn(new byte[]{80, 75});
        http.perform(get(url()).param("format", "xlsx")).andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).andExpect(content().bytes(new byte[]{80, 75}));
    }
    @Test void generationFailureCannotReturnAPartialAttachment() throws Exception {
        var snapshot = AdventureExportWritersTest.sample(1); when(reads.read(character, user)).thenReturn(snapshot);
        when(pdf.write(snapshot)).thenThrow(new IOException("synthetic failure"));
        http.perform(get(url()).param("format", "pdf")).andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith("application/json")).andExpect(header().doesNotExist("Content-Disposition"));
    }
    private String url() { return "/api/characters/" + character + "/exports"; }
}
