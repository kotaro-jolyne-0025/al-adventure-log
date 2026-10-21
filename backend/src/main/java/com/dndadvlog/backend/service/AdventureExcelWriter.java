package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.*;

@Component
public class AdventureExcelWriter {
    public byte[] write(AdventureExportSnapshot snapshot) throws IOException {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var c = snapshot.character();
            Table characters = new Table(workbook, "角色資料", "角色名稱", "玩家名稱", "種族", "子職", "派系",
                    "開卡職業", "開卡金幣", "開卡休整期", "目前職業", "目前金幣", "目前休整期", "目前永久物品", "目前靈魂幣", "匯出日期", "說明");
            characters.row(c.getCharacterName(), c.getPlayerName(), c.getRace(), c.getSubclass(), c.getFaction(),
                    c.getInitialClassesString(), c.getInitialGold(), c.getInitialDowntime(), c.getCurrentClassesString(), c.getCurrentGold(),
                    c.getCurrentDowntime(), c.getCurrentMagicItems(), c.getSoulCoins(), snapshot.exportedAt().toLocalDate(), "目前摘要為匯出時資料，不等於各筆歷史總計");
            Table entries = new Table(workbook, "冒險紀錄", "冒險編號", "代碼", "名稱", "遊玩日期", "DM",
                    "起始等級", "結束等級", "起始職業", "結束職業", "起始金幣", "冒險金幣變化", "休整金幣變化", "金幣合計",
                    "起始休整期", "冒險休整期變化", "休整天數變化", "休整期合計", "起始永久物品", "冒險物品變化", "休整物品變化", "永久物品合計",
                    "冒險物品減少", "休整物品減少", "冒險備註", "靈魂幣使用", "紀錄提醒");
            Table items = new Table(workbook, "獲得物品", "冒險編號", "遊玩日期", "冒險名稱", "取得方式", "名稱", "類型",
                    "稀有度", "分類", "需同調", "靈魂幣", "獲得數量", "庫存參考數量", "備註");
            Table activities = new Table(workbook, "休整活動", "冒險編號", "遊玩日期", "冒險名稱", "描述");
            Table awards = new Table(workbook, "故事獎勵", "冒險編號", "遊玩日期", "冒險名稱", "名稱", "敘述");
            int number = 0;
            for (var e : snapshot.entries()) {
                number++;
                entries.row(number, e.getAdventureCode(), e.getAdventureName(), e.getPlayDate(), e.getDmName(),
                        e.getStartingLevel(), e.getEndingLevel(), e.getStartingClassesString(), e.getEndingClassesString(),
                        e.getStartingGold(), e.getGoldChange(), e.getGoldDowntimeChange(), e.getGoldTotal(),
                        e.getStartingDowntime(), e.getDowntimeChange(), e.getDowntimeDowntimeChange(), e.getDowntimeTotal(),
                        e.getStartingMagicItems(), e.getMagicItemsChange(), e.getMagicItemsDowntimeChange(), e.getMagicItemsTotal(),
                        e.getMagicItemsLost(), e.getMagicItemsDowntimeLost(), e.getAdventureNotes(), e.getSoulCoinChargesUsed(),
                        String.join("\n", e.getWarnings()));
                for (var i : e.getGainedItems()) {
                    items.row(number, e.getPlayDate(), e.getAdventureName(), label(i.getAcquisitionSource()), i.getItemName(), label(i.getItemType()),
                            label(i.getRarity()), label(i.getItemCategory()), i.getRequiresAttunement(), i.getIsSoulCoin(), i.getQuantity(), null, i.getNotes());
                }
                for (var i : e.getLegacyItems()) {
                    items.row(number, e.getPlayDate(), e.getAdventureName(), label(i.getAcquisitionSource()), i.getItemName(), label(i.getItemType()),
                            label(i.getRarity()), label(i.getItemCategory()), i.getRequiresAttunement(), i.getIsSoulCoin(), null, i.getQuantity(),
                            "當時獲得數量未記錄，庫存參考數量為目前剩餘數量，非當時獲得數量。" + (i.getNotes() == null ? "" : "\n" + i.getNotes()));
                }
                for (var a : e.getDowntimeActivities()) activities.row(number, e.getPlayDate(), e.getAdventureName(), a.getDescription());
                for (var a : e.getStoryAwards()) awards.row(number, e.getPlayDate(), e.getAdventureName(), a.getAwardName(), a.getDescription());
            }
            for (Table table : List.of(characters, entries, items, activities, awards)) table.finish();
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private static String label(Object value) {
        if (value == null) return null;
        return switch (value.toString()) {
            case "ADVENTURE" -> "冒險";
            case "DOWNTIME" -> "休整期";
            case "PERMANENT" -> "永久性魔法物品";
            case "CONSUMABLE" -> "消耗品";
            case "COMMON" -> "普通";
            case "UNCOMMON" -> "非普通";
            case "RARE" -> "珍稀";
            case "VERY_RARE" -> "極珍稀";
            case "LEGENDARY" -> "傳說";
            case "ARTIFACT" -> "神器";
            case "ARMOR" -> "護甲";
            case "POTION" -> "藥水";
            case "RING" -> "戒指";
            case "ROD" -> "權杖";
            case "SCROLL" -> "捲軸";
            case "STAFF" -> "法杖";
            case "WAND" -> "魔杖";
            case "WEAPON" -> "武器";
            case "WONDROUS_ITEM" -> "奇物";
            default -> value.toString();
        };
    }

    private static final class Table {
        private static final int TEXT_LIMIT = 32767;
        private final Sheet sheet;
        private final String[] headers;
        private final CellStyle textStyle;
        private final CellStyle numberStyle;
        private final CellStyle dateStyle;
        private final CellStyle headingStyle;
        private final Map<String, Integer> extraColumns = new LinkedHashMap<>();

        Table(Workbook workbook, String name, String... headers) {
            this.headers = headers;
            sheet = workbook.createSheet(name);
            textStyle = workbook.createCellStyle();
            textStyle.setWrapText(true);
            textStyle.setVerticalAlignment(VerticalAlignment.TOP);
            numberStyle = workbook.createCellStyle();
            numberStyle.cloneStyleFrom(textStyle);
            numberStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            dateStyle = workbook.createCellStyle();
            dateStyle.cloneStyleFrom(textStyle);
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("yyyy/mm/dd"));
            headingStyle = workbook.createCellStyle();
            headingStyle.cloneStyleFrom(textStyle);
            headingStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headingStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headingStyle.setFont(font);
            Row row = sheet.createRow(0);
            row.setHeightInPoints(30);
            for (int col = 0; col < headers.length; col++) heading(col, headers[col]);
            sheet.createFreezePane(0, 1);
        }

        void row(Object... values) {
            if (values.length != headers.length) throw new IllegalArgumentException("匯出欄位數不一致");
            Row row = sheet.createRow(sheet.getLastRowNum() + 1);
            for (int col = 0; col < values.length; col++) {
                Object value = values[col];
                if (value != null && !(value instanceof Number) && !(value instanceof LocalDate) && !(value instanceof Boolean)) {
                    String text = value.toString();
                    int end = chunkEnd(text, 0);
                    value = text.substring(0, end);
                    int sequence = 2;
                    while (end < text.length()) {
                        int next = chunkEnd(text, end);
                        String title = headers[col] + "（接續 " + sequence++ + "）";
                        int extra = extraColumns.computeIfAbsent(title, name -> {
                            int index = sheet.getRow(0).getLastCellNum();
                            heading(index, name);
                            return index;
                        });
                        cell(row, extra, text.substring(end, next));
                        end = next;
                    }
                }
                cell(row, col, value);
            }
        }

        private void heading(int column, String title) {
            Cell cell = sheet.getRow(0).createCell(column);
            cell.setCellValue(title);
            cell.setCellStyle(headingStyle);
            sheet.setColumnWidth(column, 24 * 256);
        }

        private static int chunkEnd(String text, int start) {
            int end = Math.min(start + TEXT_LIMIT, text.length());
            if (end < text.length() && Character.isHighSurrogate(text.charAt(end - 1))) end--;
            return end;
        }

        private void cell(Row row, int column, Object value) {
            Cell cell = row.createCell(column);
            cell.setCellStyle(textStyle);
            if (value == null) return;
            if (value instanceof Number n) {
                cell.setCellValue(n.doubleValue());
                if (value instanceof java.math.BigDecimal) cell.setCellStyle(numberStyle);
            } else if (value instanceof LocalDate date && date.getYear() >= 1900 && date.getYear() <= 9999) {
                cell.setCellValue(date);
                cell.setCellStyle(dateStyle);
            } else if (value instanceof Boolean b) {
                cell.setCellValue(b ? "是" : "否");
            } else {
                cell.setCellValue(value.toString());
            }
        }

        void finish() {
            sheet.setAutoFilter(new CellRangeAddress(0, sheet.getLastRowNum(), 0, sheet.getRow(0).getLastCellNum() - 1));
        }
    }
}
