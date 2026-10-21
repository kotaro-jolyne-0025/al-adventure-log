package com.dndadvlog.backend.controller;

import com.dndadvlog.backend.config.UserPrincipal;
import com.dndadvlog.backend.exception.BusinessException;
import com.dndadvlog.backend.service.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@RestController
public class AdventureExportController {
    private final AdventureExportReadService snapshots;
    private final AdventurePdfWriter pdf;
    private final AdventureExcelWriter excel;

    public AdventureExportController(AdventureExportReadService snapshots, AdventurePdfWriter pdf, AdventureExcelWriter excel) {
        this.snapshots = snapshots;
        this.pdf = pdf;
        this.excel = excel;
    }

    @GetMapping("/api/characters/{characterId}/exports")
    public ResponseEntity<byte[]> download(@PathVariable String characterId,
            @RequestParam(required = false) String format, @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!"pdf".equals(format) && !"xlsx".equals(format)) throw new BusinessException("請指定匯出格式 pdf 或 xlsx");
        UUID id;
        try { id = UUID.fromString(characterId); }
        catch (IllegalArgumentException invalid) { throw new BusinessException("角色識別碼不正確"); }
        var snapshot = snapshots.read(id, principal.getId());
        // File generation starts after the read transaction has closed.
        byte[] bytes = "pdf".equals(format) ? pdf.write(snapshot) : excel.write(snapshot);
        String name = snapshot.character().getCharacterName();
        name = name == null ? "角色" : name.replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_").strip();
        name = name.codePoints().limit(50).collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString();
        if (name.isBlank()) name = "角色";
        String filename = "冒險紀錄_" + name + "_" + snapshot.exportedAt().toLocalDate().format(DateTimeFormatter.BASIC_ISO_DATE) + "." + format;
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("pdf".equals(format) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(bytes);
    }
}
