package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.entity.InventoryItem.ItemCategory;
import com.dndadvlog.backend.exception.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

public class AdventureExportWritersTest {
    public static AdventureExportSnapshot sample(int count) {
        var c = new CharacterResponse();
        c.setId(UUID.fromString("10000000-0000-0000-0000-000000000001"));
        c.setCharacterName("霧谷旅人"); c.setPlayerName("測試玩家"); c.setRace("人類"); c.setFaction("豎琴手");
        c.setCurrentClassesString(count > 0 ? "Wizard5 / Fighter1" : "Wizard5"); c.setInitialClassesString("Wizard5");
        c.setCurrentGold(new BigDecimal("100.50")); c.setInitialGold(new BigDecimal("100.50")); c.setInitialDowntime(10);
        c.setCurrentDowntime(10); c.setCurrentMagicItems(1); c.setSoulCoins(3);
        c.setAvatarUrl("PRIVATE_AVATAR"); c.setUserId(UUID.randomUUID());
        List<AdventureEntryResponse> entries = new ArrayList<>();
        for (int n = 0; n < count; n++) {
            var e = new AdventureEntryResponse();
            e.setId(UUID.randomUUID()); e.setCharacterId(c.getId()); e.setAdventureCode("DDAL-TEST-" + (n + 1));
            e.setAdventureName("迷霧森林的祕密 " + (n + 1)); e.setDmName("試作 DM"); e.setPlayDate(LocalDate.of(2026, 10, 18).plusDays(n));
            var previous = n == 0 ? null : entries.get(n - 1);
            e.setStartingLevel(previous == null ? 5 : previous.getEndingLevel()); e.setEndingLevel(6);
            e.setStartingClassesString(previous == null ? "Wizard5" : previous.getEndingClassesString()); e.setEndingClassesString("Wizard5 / Fighter1");
            e.setStartingGold(previous == null ? c.getInitialGold() : previous.getGoldTotal());
            e.setGoldChange(new BigDecimal("40")); e.setGoldDowntimeChange(new BigDecimal("-20.25"));
            e.setGoldTotal(e.getStartingGold().add(e.getGoldChange()).add(e.getGoldDowntimeChange()));
            e.setStartingDowntime(previous == null ? c.getInitialDowntime() : previous.getDowntimeTotal());
            e.setDowntimeChange(10); e.setDowntimeDowntimeChange(-5); e.setDowntimeTotal(e.getStartingDowntime() + 5);
            e.setStartingMagicItems(previous == null ? 1 : previous.getMagicItemsTotal());
            e.setMagicItemsChange(1); e.setMagicItemsDowntimeChange(0); e.setMagicItemsTotal(e.getStartingMagicItems() + 1);
            e.setMagicItemsLost(0); e.setMagicItemsDowntimeLost(0); e.setRecordingModelVersion(2); e.setSoulCoinChargesUsed("1");
            e.setAdventureNotes("完整自由備註；只在 Excel 顯示");
            e.setCreatedAt(LocalDateTime.of(2026, 10, 18, 12, 13, 14, 123456000)); e.setUpdatedAt(e.getCreatedAt());
            var i = new AdventureGainedItemResponse(); i.setId(UUID.randomUUID()); i.setAdventureEntryId(e.getId());
            i.setItemName("治療藥水"); i.setQuantity(2); i.setItemType("CONSUMABLE"); i.setAcquisitionSource(AcquisitionSource.ADVENTURE);
            i.setNotes("已消耗一瓶但歷史仍為兩瓶"); i.setRequiresAttunement(false); i.setIsSoulCoin(false);
            var a = new DowntimeActivityResponse(); a.setId(UUID.randomUUID()); a.setDescription("抄寫法術，花費5天、20.25金");
            var award = new StoryAwardResponse(); award.setId(UUID.randomUUID()); award.setAwardName("森林之友"); award.setDescription("完整故事獎勵敘述");
            e.setDowntimeActivities(List.of(a)); e.setStoryAwards(List.of(award)); e.setGainedItems(List.of(i)); e.setLegacyItems(List.of()); e.setWarnings(List.of());
            entries.add(e);
            c.setCurrentGold(e.getGoldTotal()); c.setCurrentDowntime(e.getDowntimeTotal()); c.setCurrentMagicItems(e.getMagicItemsTotal());
        }
        return new AdventureExportSnapshot(c, OffsetDateTime.parse("2026-10-18T12:00:00+08:00"), entries);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 4, 7})
    void pdfRepeatsOnlyRequiredPagesAndPreservesArtworkAndCanonicalFields(int count) throws Exception {
        var snapshot = sample(count);
        byte[] bytes = new AdventurePdfWriter().write(snapshot);
        try (var source = Loader.loadPDF(AdventurePdfWriter.class.getResourceAsStream("/export/adventure-log-template.pdf").readAllBytes());
             var result = Loader.loadPDF(bytes)) {
            assertEquals("7f92c6298fa23f78ca2334a642b1f9552e0f039977e22c452c8d1c7fd3f5e3b9", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(AdventurePdfWriter.class.getResourceAsStream("/export/adventure-log-template.pdf").readAllBytes())));
            assertEquals((count + 2) / 3, result.getNumberOfPages());
            var form = result.getDocumentCatalog().getAcroForm();
            assertEquals(result.getNumberOfPages() * 66, form.getFields().size());
            assertFalse(form.getNeedAppearances());
            assertEquals(form.getFields().size(), form.getFields().stream().map(f -> f.getFullyQualifiedName()).distinct().count());
            for (int page = 0; page < result.getNumberOfPages(); page++) {
                assertArrayEquals(source.getPage(0).getContents().readAllBytes(), result.getPage(page).getContents().readAllBytes());
                assertEquals(630, result.getPage(page).getMediaBox().getWidth());
                assertEquals(810, result.getPage(page).getMediaBox().getHeight());
                assertEquals(66, result.getPage(page).getAnnotations().size());
                for (var widget : result.getPage(page).getAnnotations()) {
                    var field = form.getField(widget.getCOSObject().getString(COSName.T));
                    assertNotNull(field);
                    assertSame(field.getCOSObject(), widget.getCOSObject());
                    assertTrue(widget.isPrinted());
                    assertNotNull(widget.getNormalAppearanceStream());
                    assertTrue(widget.getNormalAppearanceStream().getContents().readAllBytes().length > 0);
                    assertTrue(widget.getNormalAppearanceStream().getResources().getFontNames().iterator().hasNext() || field.getValueAsString().isEmpty());
                    try (var appearanceDocument = new PDDocument()) {
                        var appearancePage = new PDPage(widget.getNormalAppearanceStream().getBBox());
                        appearancePage.getCOSObject().setItem(COSName.CONTENTS, widget.getNormalAppearanceStream());
                        appearancePage.setResources(widget.getNormalAppearanceStream().getResources());
                        appearanceDocument.addPage(appearancePage);
                        assertEquals(field.getValueAsString().strip(), new PDFTextStripper().getText(appearanceDocument).strip());
                    }
                }
                assertEquals("測試玩家", form.getField("p" + (page + 1) + "_Player Name").getValueAsString());
                assertEquals("" + (page + 1), form.getField("p" + (page + 1) + "_Sheet").getValueAsString());
            }
            for (int index = 0; index < count; index++) {
                String prefix = "p" + (index / 3 + 1) + "_";
                String suffix = index % 3 == 0 ? "" : "_" + (index % 3 + 1);
                assertEquals(snapshot.entries().get(index).getAdventureCode(), form.getField(prefix + "Adventure Code" + suffix).getValueAsString());
                assertEquals("+19.75", form.getField(prefix + "Gold" + suffix).getValueAsString());
                assertEquals(snapshot.entries().get(index).getGoldTotal().stripTrailingZeros().toPlainString(), form.getField(prefix + "Gold Total" + suffix).getValueAsString());
            }
            if (count % 3 != 0) assertEquals("", form.getField("p" + result.getNumberOfPages() + "_Adventure Name_3").getValueAsString());
            String note = form.getField("p1_Adventure NotesDowntime Activity 1").getValueAsString()
                    + form.getField("p1_Adventure NotesDowntime Activity 2").getValueAsString();
            assertTrue(note.contains("休整：")); assertTrue(note.contains("治療藥水×2"));
            assertFalse(note.contains("完整自由備註"));
        }
        if (Boolean.getBoolean("export.artifacts") && count == 7) {
            var directory = Path.of("../output/export"); Files.createDirectories(directory);
            snapshot.entries().get(1).getDowntimeActivities().get(0).setDescription("抄寫法術，花費5天、50金；" + "繁體中文備註用於核對列印邊界、歷史獲得物品與休整活動。".repeat(8));
            snapshot.entries().get(2).getDowntimeActivities().get(0).setDescription("研究古卷 😀 e\u0301；製作卷軸，花費5天、50金");
            bytes = new AdventurePdfWriter().write(snapshot);
            Files.write(directory.resolve("character-log.pdf"), bytes);
            Files.write(directory.resolve("character-log.xlsx"), new AdventureExcelWriter().write(snapshot));
        }
    }

    @Test
    void sampleCarriesPreviousBalancesIntoNextAdventureInExcelAndPdf() throws Exception {
        var snapshot = sample(7);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(new AdventureExcelWriter().write(snapshot)));
             var pdf = Loader.loadPDF(new AdventurePdfWriter().write(snapshot))) {
            var sheet = workbook.getSheet("冒險紀錄"); var form = pdf.getDocumentCatalog().getAcroForm();
            assertEquals(100.50, sheet.getRow(1).getCell(column(sheet, "起始金幣")).getNumericCellValue());
            assertEquals(120.25, sheet.getRow(2).getCell(column(sheet, "起始金幣")).getNumericCellValue());
            assertEquals(140.00, sheet.getRow(3).getCell(column(sheet, "起始金幣")).getNumericCellValue());
            for (int index = 0; index < snapshot.entries().size(); index++) {
                var row = sheet.getRow(index + 1);
                double start = row.getCell(column(sheet, "起始金幣")).getNumericCellValue();
                double total = row.getCell(column(sheet, "金幣合計")).getNumericCellValue();
                assertEquals(start + row.getCell(column(sheet, "冒險金幣變化")).getNumericCellValue()
                        + row.getCell(column(sheet, "休整金幣變化")).getNumericCellValue(), total);
                if (index > 0) {
                    var previous = sheet.getRow(index);
                    assertEquals(previous.getCell(column(sheet, "金幣合計")).getNumericCellValue(), start);
                    assertEquals(previous.getCell(column(sheet, "休整期合計")).getNumericCellValue(), row.getCell(column(sheet, "起始休整期")).getNumericCellValue());
                    assertEquals(previous.getCell(column(sheet, "永久物品合計")).getNumericCellValue(), row.getCell(column(sheet, "起始永久物品")).getNumericCellValue());
                }
                String prefix = "p" + (index / 3 + 1) + "_", suffix = index % 3 == 0 ? "" : "_" + (index % 3 + 1);
                assertEquals(start, Double.parseDouble(form.getField(prefix + "Starting Gold" + suffix).getValueAsString()));
                assertEquals(total, Double.parseDouble(form.getField(prefix + "Gold Total" + suffix).getValueAsString()));
            }
            assertEquals(new BigDecimal("238.75"), snapshot.character().getCurrentGold());
            assertEquals(238.75, workbook.getSheet("角色資料").getRow(1).getCell(column(workbook.getSheet("角色資料"), "目前金幣")).getNumericCellValue());
        }
    }

    @Test
    void summaryUsesStoredSourcesWarningsAndDescriptionsWithoutParsingOrEffects() {
        var snapshot = sample(1); var e = snapshot.entries().get(0);
        e.setWarnings(List.of("此紀錄與下一筆歷史快照不連續；後續快照未自動改寫"));
        var downtimeItem = new AdventureGainedItemResponse(); downtimeItem.setItemName("卷軸"); downtimeItem.setQuantity(1); downtimeItem.setAcquisitionSource(AcquisitionSource.DOWNTIME);
        e.setGainedItems(List.of(e.getGainedItems().get(0), downtimeItem));
        e.getDowntimeActivities().get(0).setDescription("抄寫法術\n 花費5天、50金");
        assertEquals("歷史快照不連續；獲得：治療藥水×2；休整獲得：卷軸×1；休整：抄寫法術 花費5天、50金；故事獎勵：森林之友", AdventurePdfWriter.noteSummary(e));
        assertEquals(new BigDecimal("-20.25"), e.getGoldDowntimeChange());
        e.setGainedItems(List.of()); e.setStoryAwards(List.of()); e.setDowntimeActivities(List.of()); e.setWarnings(List.of());
        assertEquals("", AdventurePdfWriter.noteSummary(e));
    }

    @Test
    void measuresLargeCompleteExportsWithLongDetails() throws Exception {
        if (!Boolean.getBoolean("export.benchmark")) return;
        int count = 1000;
        var snapshot = sample(count);
        for (var e : snapshot.entries()) {
            e.setAdventureNotes("合成長備註：".repeat(150));
            e.getDowntimeActivities().get(0).setDescription("研究古卷與抄寫法術；".repeat(60));
        }
        for (String format : List.of("pdf", "xlsx")) {
            System.gc();
            var memory = java.lang.management.ManagementFactory.getMemoryMXBean();
            var peak = new java.util.concurrent.atomic.AtomicLong();
            var sampler = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
            sampler.scheduleAtFixedRate(() -> peak.accumulateAndGet(memory.getHeapMemoryUsage().getUsed(), Math::max), 0, 10, java.util.concurrent.TimeUnit.MILLISECONDS);
            long start = System.nanoTime();
            byte[] bytes;
            try { bytes = format.equals("pdf") ? new AdventurePdfWriter().write(snapshot) : new AdventureExcelWriter().write(snapshot); }
            finally { sampler.shutdownNow(); }
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            System.out.printf("EXPORT_BENCHMARK format=%s entries=%d milliseconds=%d bytes=%d sampledHeapPeakMiB=%.1f maxHeapMiB=%.1f%n", format, count, elapsed, bytes.length, peak.get() / 1048576.0, Runtime.getRuntime().maxMemory() / 1048576.0);
            if (format.equals("pdf")) try (var doc = Loader.loadPDF(bytes)) { assertEquals(334, doc.getNumberOfPages()); }
            else try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) { assertEquals(1000, book.getSheet("冒險紀錄").getLastRowNum()); assertEquals(1000, book.getSheet("休整活動").getLastRowNum()); }
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {119, 120, 121, 400})
    void pdfTruncatesRealValuesAndAppearancesAtGraphemeBoundaries(int length) throws Exception {
        var snapshot = sample(1); var e = snapshot.entries().get(0);
        e.setGainedItems(List.of()); e.setStoryAwards(List.of());
        e.getDowntimeActivities().get(0).setDescription("備".repeat(length - 5) + "😀e\u0301");
        try (var result = Loader.loadPDF(new AdventurePdfWriter().write(snapshot))) {
            var form = result.getDocumentCatalog().getAcroForm();
            String note = form.getField("p1_Adventure NotesDowntime Activity 1").getValueAsString()
                    + form.getField("p1_Adventure NotesDowntime Activity 2").getValueAsString() + form.getField("p1_undefined").getValueAsString();
            assertTrue(Pattern.compile("\\X").matcher(note).results().count() <= 120);
            if (length > 120) assertTrue(note.endsWith("…"));
            else assertEquals(AdventurePdfWriter.noteSummary(e), note);
            assertFalse(note.endsWith("e"));
            assertFalse(note.contains("備".repeat(121)));
        }
    }

    @Test
    void pdfRejectsUnsupportedGlyphAndKeepsUnknownDistinctFromZero() throws Exception {
        var snapshot = sample(1); var e = snapshot.entries().get(0);
        e.setStartingGold(null); e.setGoldChange(null); e.setGoldTotal(BigDecimal.ZERO);
        try (var result = Loader.loadPDF(new AdventurePdfWriter().write(snapshot))) {
            var form = result.getDocumentCatalog().getAcroForm();
            assertEquals("—", form.getField("p1_Starting Gold").getValueAsString());
            assertEquals("—", form.getField("p1_Gold").getValueAsString());
            assertEquals("0", form.getField("p1_Gold Total").getValueAsString());
        }
        snapshot.character().setCharacterName("\u0378");
        assertThrows(BusinessException.class, () -> new AdventurePdfWriter().write(snapshot));
    }

    @Test
    void excelKeepsReadableRowsAndFullTextWithoutSystemColumns() throws Exception {
        var snapshot = sample(2);
        var first = snapshot.entries().get(0); var second = snapshot.entries().get(1);
        second.setAdventureName(first.getAdventureName()); second.setPlayDate(first.getPlayDate());
        String noise = new Random(17).ints(40000, 'a', 'z' + 1)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString();
        String longFirst = "甲😀\n" + noise, longSecond = "乙\n" + noise;
        snapshot.character().setRace(longFirst);
        snapshot.character().setFaction(longSecond);
        first.setAdventureNotes(longFirst); second.setAdventureNotes(longSecond);
        first.setSoulCoinChargesUsed(longSecond);
        var item = second.getGainedItems().get(0);
        first.getGainedItems().get(0).setNotes(longFirst); item.setNotes(longSecond);
        first.setGainedItems(List.of(first.getGainedItems().get(0), item)); second.setGainedItems(List.of());
        var activity = second.getDowntimeActivities().get(0);
        first.getDowntimeActivities().get(0).setDescription(longFirst); activity.setDescription(longSecond);
        first.setDowntimeActivities(List.of(first.getDowntimeActivities().get(0), activity)); second.setDowntimeActivities(List.of());
        var award = second.getStoryAwards().get(0);
        first.getStoryAwards().get(0).setDescription(longFirst); award.setDescription(longSecond);
        first.setStoryAwards(List.of(first.getStoryAwards().get(0), award)); second.setStoryAwards(List.of());
        var fields = Map.of("角色資料", "種族", "冒險紀錄", "冒險備註", "獲得物品", "備註", "休整活動", "描述", "故事獎勵", "敘述");
        var uuid = Pattern.compile("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(new AdventureExcelWriter().write(snapshot)))) {
            for (var sheet : workbook) {
                assertPlayerColumns(sheet);
                assertEquals(sheet.getSheetName().equals("角色資料") ? 1 : 2, sheet.getLastRowNum());
                for (var row : sheet) {
                    for (var cell : row) if (cell.getCellType() == CellType.STRING) assertFalse(uuid.matcher(cell.getStringCellValue()).find());
                    if (row.getRowNum() == 0) continue;
                    String target = fields.get(sheet.getSheetName());
                    assertNotNull(row.getCell(column(sheet, target + "（接續 2）")));
                    assertEquals(row.getRowNum() == 1 ? longFirst : longSecond, fullText(sheet, row, target));
                    if (List.of("獲得物品", "休整活動", "故事獎勵").contains(sheet.getSheetName())) {
                        assertEquals(1, row.getCell(column(sheet, "冒險編號")).getNumericCellValue());
                        assertEquals(first.getAdventureName(), row.getCell(column(sheet, "冒險名稱")).getStringCellValue());
                        assertEquals(first.getPlayDate(), row.getCell(column(sheet, "遊玩日期")).getLocalDateTimeCellValue().toLocalDate());
                    } else if (sheet.getSheetName().equals("冒險紀錄")) {
                        assertEquals(row.getRowNum(), row.getCell(column(sheet, "冒險編號")).getNumericCellValue());
                    }
                }
                var filter = org.apache.poi.ss.util.CellRangeAddress.valueOf(((org.apache.poi.xssf.usermodel.XSSFSheet) sheet).getCTWorksheet().getAutoFilter().getRef());
                assertEquals(sheet.getRow(0).getLastCellNum() - 1, filter.getLastColumn());
                assertEquals(sheet.getLastRowNum(), filter.getLastRow());
            }
            assertEquals(longSecond, fullText(workbook.getSheet("角色資料"), workbook.getSheet("角色資料").getRow(1), "派系"));
            assertEquals(longSecond, fullText(workbook.getSheet("冒險紀錄"), workbook.getSheet("冒險紀錄").getRow(1), "靈魂幣使用"));
        }
    }

    @Test
    void excelNormalWorkbookShowsOnlyPlayerFieldsAndChineseValuesIncludingEmptySheets() throws Exception {
        var snapshot = sample(2);
        var first = snapshot.entries().get(0); var second = snapshot.entries().get(1);
        var potion = first.getGainedItems().get(0);
        potion.setRarity("COMMON"); potion.setItemCategory(ItemCategory.POTION); potion.setNeedsDetails(true);
        var sword = second.getGainedItems().get(0);
        sword.setItemType("PERMANENT"); sword.setRarity("LEGENDARY"); sword.setItemCategory(ItemCategory.WEAPON);
        sword.setAcquisitionSource(AcquisitionSource.DOWNTIME); sword.setRequiresAttunement(true); sword.setIsSoulCoin(null);
        first.setWarnings(List.of("與前一筆紀錄的金幣不連續"));
        first.setDowntimeActivities(List.of()); second.setDowntimeActivities(List.of());
        var counts = Map.of("角色資料", 15, "冒險紀錄", 26, "獲得物品", 13, "休整活動", 4, "故事獎勵", 5);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(new AdventureExcelWriter().write(snapshot)))) {
            for (var sheet : workbook) {
                assertPlayerColumns(sheet);
                assertEquals(counts.get(sheet.getSheetName()).intValue(), sheet.getRow(0).getLastCellNum());
                for (var heading : sheet.getRow(0)) assertFalse(heading.getStringCellValue().contains("接續"));
            }
            assertEquals(0, workbook.getSheet("休整活動").getLastRowNum());
            var items = workbook.getSheet("獲得物品");
            assertEquals("冒險", items.getRow(1).getCell(column(items, "取得方式")).getStringCellValue());
            assertEquals("消耗品", items.getRow(1).getCell(column(items, "類型")).getStringCellValue());
            assertEquals("普通", items.getRow(1).getCell(column(items, "稀有度")).getStringCellValue());
            assertEquals("藥水", items.getRow(1).getCell(column(items, "分類")).getStringCellValue());
            assertEquals("否", items.getRow(1).getCell(column(items, "需同調")).getStringCellValue());
            assertEquals("否", items.getRow(1).getCell(column(items, "靈魂幣")).getStringCellValue());
            assertEquals("休整期", items.getRow(2).getCell(column(items, "取得方式")).getStringCellValue());
            assertEquals("永久性魔法物品", items.getRow(2).getCell(column(items, "類型")).getStringCellValue());
            assertEquals("傳說", items.getRow(2).getCell(column(items, "稀有度")).getStringCellValue());
            assertEquals("武器", items.getRow(2).getCell(column(items, "分類")).getStringCellValue());
            assertEquals("是", items.getRow(2).getCell(column(items, "需同調")).getStringCellValue());
            assertEquals(CellType.BLANK, items.getRow(2).getCell(column(items, "靈魂幣")).getCellType());
            var entries = workbook.getSheet("冒險紀錄");
            assertEquals(first.getWarnings().get(0), entries.getRow(1).getCell(column(entries, "紀錄提醒")).getStringCellValue());
            var characters = workbook.getSheet("角色資料");
            assertEquals(snapshot.exportedAt().toLocalDate(), characters.getRow(1).getCell(column(characters, "匯出日期")).getLocalDateTimeCellValue().toLocalDate());
        }
    }

    private static void assertPlayerColumns(Sheet sheet) {
        var excluded = Set.of("列類型", "資料編號", "待補", "歷史模型版本", "建立時間", "更新時間", "資料來源");
        for (var heading : sheet.getRow(0)) {
            String title = heading.getStringCellValue();
            assertFalse(title.contains("ID")); assertFalse(title.contains("續文")); assertFalse(excluded.contains(title));
        }
    }

    private static String fullText(Sheet sheet, Row row, String title) {
        StringBuilder text = new StringBuilder(row.getCell(column(sheet, title)).getStringCellValue());
        for (var heading : sheet.getRow(0)) {
            if (heading.getStringCellValue().startsWith(title + "（接續 ")) {
                var cell = row.getCell(heading.getColumnIndex());
                if (cell != null) text.append(cell.getStringCellValue());
            }
        }
        return text.toString();
    }

    private static int column(Sheet sheet, String title) {
        for (var cell : sheet.getRow(0)) if (title.equals(cell.getStringCellValue())) return cell.getColumnIndex();
        throw new AssertionError("缺少欄位：" + title);
    }

    @Test
    void excelRetainsTypesFullTextAndChildLinksWithoutExecutableContent() throws Exception {
        var snapshot = sample(2); var e = snapshot.entries().get(0);
        e.setAdventureName("=HYPERLINK(\"https://example.invalid\")"); e.setDmName("+SUM(A1)");
        StringBuilder tail = new StringBuilder(); var random = new Random(42);
        for (int n = 0; n < 40000; n++) tail.append((char) ('a' + random.nextInt(26)));
        e.setAdventureNotes("漢".repeat(32766) + "😀" + tail);
        e.setStartingGold(null); e.setGoldTotal(BigDecimal.ZERO);
        snapshot.entries().get(1).setPlayDate(LocalDate.of(1800, 1, 1));
        var legacy = new InventoryItemResponse(); legacy.setId(UUID.randomUUID()); legacy.setItemName("@參考庫存"); legacy.setQuantity(1);
        e.setLegacyItems(List.of(legacy));
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(new AdventureExcelWriter().write(snapshot)))) {
            assertEquals(List.of("角色資料", "冒險紀錄", "獲得物品", "休整活動", "故事獎勵"), workbook.sheetIterator().hasNext() ? java.util.stream.IntStream.range(0, 5).mapToObj(workbook::getSheetName).toList() : List.of());
            var sheet = workbook.getSheet("冒險紀錄"); var row = sheet.getRow(1);
            assertEquals(CellType.STRING, row.getCell(column(sheet, "名稱")).getCellType()); assertEquals(e.getAdventureName(), row.getCell(column(sheet, "名稱")).getStringCellValue());
            var date = row.getCell(column(sheet, "遊玩日期"));
            assertEquals(CellType.NUMERIC, date.getCellType()); assertTrue(DateUtil.isCellDateFormatted(date));
            assertEquals(LocalDate.of(2026, 10, 18), date.getLocalDateTimeCellValue().toLocalDate());
            assertEquals("1800-01-01", sheet.getRow(2).getCell(column(sheet, "遊玩日期")).getStringCellValue());
            assertEquals(CellType.BLANK, row.getCell(column(sheet, "起始金幣")).getCellType());
            assertEquals(0, row.getCell(column(sheet, "金幣合計")).getNumericCellValue());
            assertEquals(-20.25, row.getCell(column(sheet, "休整金幣變化")).getNumericCellValue());
            assertEquals(2, sheet.getLastRowNum());
            assertEquals(e.getAdventureNotes(), fullText(sheet, row, "冒險備註"));
            String firstChunk = row.getCell(column(sheet, "冒險備註")).getStringCellValue();
            assertFalse(Character.isHighSurrogate(firstChunk.charAt(firstChunk.length() - 1)));
            var items = workbook.getSheet("獲得物品");
            assertEquals(2, items.getRow(1).getCell(column(items, "獲得數量")).getNumericCellValue());
            assertEquals(CellType.BLANK, items.getRow(2).getCell(column(items, "獲得數量")).getCellType());
            assertEquals(1, items.getRow(2).getCell(column(items, "庫存參考數量")).getNumericCellValue());
            assertTrue(items.getRow(2).getCell(column(items, "備註")).getStringCellValue().contains("當時獲得數量未記錄"));
            for (var s : workbook) {
                assertPlayerColumns(s);
                assertNotNull(s.getPaneInformation()); assertEquals(1, s.getPaneInformation().getHorizontalSplitPosition());
                assertEquals(0, s.getNumMergedRegions());
                for (var r : s) for (var cell : r) {
                    assertNotEquals(CellType.FORMULA, cell.getCellType()); assertNull(cell.getHyperlink());
                    if (cell.getCellType() == CellType.STRING) assertFalse(cell.getStringCellValue().contains("PRIVATE_AVATAR"));
                }
            }
            assertTrue(workbook.getExternalLinksTable().isEmpty());
        }
    }
}
