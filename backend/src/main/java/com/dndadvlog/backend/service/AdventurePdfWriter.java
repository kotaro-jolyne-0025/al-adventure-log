package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.*;
import com.dndadvlog.backend.entity.AcquisitionSource;
import com.dndadvlog.backend.exception.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.interactive.annotation.*;
import org.apache.pdfbox.pdmodel.interactive.form.*;
import org.springframework.stereotype.Component;

import java.io.*;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class AdventurePdfWriter {
    private static final Pattern GRAPHEME = Pattern.compile("\\X");
    private static final String[] NOTE_FIELDS = {"Adventure NotesDowntime Activity 1", "Adventure NotesDowntime Activity 2", "undefined"};

    public byte[] write(AdventureExportSnapshot snapshot) throws IOException {
        if (snapshot.entries().isEmpty()) throw new BusinessException("尚無冒險紀錄可匯出");
        try (var source = resource("adventure-log-template.pdf");
             var template = Loader.loadPDF(source.readAllBytes());
             var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            Fonts fonts = new Fonts(document);
            var form = new PDAcroForm(document);
            form.setDefaultResources(new PDResources());
            form.getDefaultResources().put(COSName.getPDFName("ExportTC"), fonts.text);
            form.getDefaultResources().put(COSName.getPDFName("ExportEmoji"), fonts.emoji);
            form.setDefaultAppearance("/ExportTC 11 Tf 0 g");
            form.setNeedAppearances(false);
            document.getDocumentCatalog().setAcroForm(form);
            List<PDField> fields = new ArrayList<>();
            var originals = template.getDocumentCatalog().getAcroForm();
            if (originals.getFields().size() != 132 || template.getPage(0).getAnnotations().size() != 66)
                throw new IOException("PDF 範本欄位不符");
            int pages = (snapshot.entries().size() + 2) / 3;
            for (int pageNumber = 0; pageNumber < pages; pageNumber++) {
                var page = document.importPage(template.getPage(0));
                page.setResources(template.getPage(0).getResources());
                page.setAnnotations(new ArrayList<>());
                Map<String, String> values = values(snapshot, pageNumber, originals, fonts);
                for (var originalWidget : template.getPage(0).getAnnotations()) {
                    var original = originals.getField(originalWidget.getCOSObject().getString(COSName.T));
                    String name = original.getPartialName();
                    var rectangle = originalWidget.getRectangle();
                    float size = name.startsWith("Soul Coin Charges Used") ? 6 : 11;
                    float padding = size == 6 ? .5f : 4;
                    String value = values.getOrDefault(name, "");
                    boolean numeric = isNumericField(name);
                    String fitted = fonts.fit(value, rectangle.getWidth() - 2 * padding, size);
                    if (numeric && !fitted.equals(value)) throw new BusinessException("數值過長，無法放入原版 PDF 欄位，請改匯出 Excel");
                    var field = new PDTextField(form);
                    field.setPartialName("p" + (pageNumber + 1) + "_" + name);
                    field.setDefaultAppearance("/ExportTC " + size + " Tf 0 g");
                    field.getCOSObject().setString(COSName.V, fitted);
                    var widget = field.getWidgets().get(0);
                    widget.setRectangle(new PDRectangle(rectangle.getLowerLeftX(), rectangle.getLowerLeftY(), rectangle.getWidth(), rectangle.getHeight()));
                    widget.setPage(page);
                    widget.setPrinted(true);
                    var appearance = new PDAppearanceStream(document);
                    appearance.setBBox(new PDRectangle(rectangle.getWidth(), rectangle.getHeight()));
                    appearance.setResources(new PDResources());
                    try (var appearanceOutput = appearance.getCOSObject().createOutputStream(COSName.FLATE_DECODE);
                         var stream = new PDPageContentStream(document, appearance, appearanceOutput)) {
                        var blank = originalWidget.getNormalAppearanceStream();
                        if (blank != null) stream.drawForm(blank);
                        fonts.draw(stream, fitted, size, padding, (rectangle.getHeight() - size) / 2 + size * .12f);
                    }
                    var appearances = new PDAppearanceDictionary();
                    appearances.setNormalAppearance(appearance);
                    widget.setAppearance(appearances);
                    fields.add(field);
                    page.getAnnotations().add(widget);
                }
            }
            form.setFields(fields);
            document.getDocumentInformation().setTitle("冒險紀錄");
            document.getDocumentInformation().setSubject("角色摘要為匯出時狀態；原版範本包含舊季別文字；備註為最多120字截尾摘要，完整資料見網站或Excel。匯出時間：" + snapshot.exportedAt());
            document.save(output);
            return output.toByteArray();
        }
    }

    private Map<String, String> values(AdventureExportSnapshot snapshot, int page, PDAcroForm originals, Fonts fonts) throws IOException {
        var c = snapshot.character();
        Map<String, String> values = new HashMap<>();
        put(values, "Character Name", c.getCharacterName());
        put(values, "Player Name", c.getPlayerName());
        put(values, "Race Classes Levels", join(c.getRace(), c.getCurrentClassesString(), c.getSubclass()));
        put(values, "Faction", c.getFaction());
        put(values, "Soul Coins Carried", number(c.getSoulCoins()));
        put(values, "Sheet", page + 1);
        for (int block = 0; block < 3 && page * 3 + block < snapshot.entries().size(); block++) {
            var e = snapshot.entries().get(page * 3 + block);
            String suffix = block == 0 ? "" : "_" + (block + 1);
            put(values, "Adventure Code" + suffix, e.getAdventureCode());
            put(values, "Adventure Name" + suffix, e.getAdventureName());
            put(values, "Date" + suffix, e.getPlayDate() == null ? "未指定" : e.getPlayDate().format(DateTimeFormatter.ofPattern("yyyy/MM/dd")));
            put(values, "DM Name" + suffix, e.getDmName());
            put(values, "Starting Level" + suffix, number(e.getStartingLevel()));
            put(values, "Ending Level" + suffix, number(e.getEndingLevel()));
            put(values, "Level Accepted YN" + suffix, e.getStartingLevel() == null || e.getEndingLevel() == null ? "—" : e.getEndingLevel() > e.getStartingLevel() ? "Y" : "N");
            put(values, "Starting Gold" + suffix, number(e.getStartingGold()));
            put(values, "Gold" + suffix, sum(e.getGoldChange(), e.getGoldDowntimeChange()));
            put(values, "Gold Total" + suffix, number(e.getGoldTotal()));
            put(values, "Starting Downtime" + suffix, number(e.getStartingDowntime()));
            put(values, "Downtime" + suffix, sum(e.getDowntimeChange(), e.getDowntimeDowntimeChange()));
            put(values, "Downtime Total" + suffix, number(e.getDowntimeTotal()));
            put(values, "Starting Permanent Magic Items" + suffix, number(e.getStartingMagicItems()));
            put(values, "Magic Items" + suffix, sum(e.getMagicItemsChange(), e.getMagicItemsDowntimeChange()));
            put(values, "Total Permanent Magic Items" + suffix, number(e.getMagicItemsTotal()));
            put(values, "Soul Coin Charges Used" + suffix, e.getSoulCoinChargesUsed());
            float[] widths = new float[3];
            for (int line = 0; line < 3; line++) widths[line] = originals.getField(NOTE_FIELDS[line] + suffix).getWidgets().get(0).getRectangle().getWidth() - 8;
            var lines = fonts.notes(noteSummary(e), widths);
            for (int line = 0; line < lines.size(); line++) put(values, NOTE_FIELDS[line] + suffix, lines.get(line));
        }
        return values;
    }

    static String noteSummary(AdventureEntryResponse entry) {
        List<String> parts = new ArrayList<>();
        for (String warning : entry.getWarnings()) {
            if (warning.contains("不連續")) parts.add("歷史快照不連續");
            else if (warning.contains("原始獲得數量未知")) parts.add("舊物品歷史數量未知");
            else if (warning.contains("等級下降")) parts.add("等級下降待確認");
            else if (warning.contains("魔法物品減少")) parts.add("物品減少待核對倉庫");
            else parts.add(normalize(warning));
        }
        for (var source : AcquisitionSource.values()) {
            String names = entry.getGainedItems().stream()
                    .filter(i -> i.getAcquisitionSource() == source || (source == AcquisitionSource.ADVENTURE && i.getAcquisitionSource() == null))
                    .map(i -> normalize(i.getItemName()) + "×" + number(i.getQuantity())).collect(Collectors.joining("、"));
            if (!names.isEmpty()) parts.add((source == AcquisitionSource.ADVENTURE ? "獲得：" : "休整獲得：") + names);
        }
        if (!entry.getLegacyItems().isEmpty()) parts.add("現存參考：" + entry.getLegacyItems().stream().map(i -> normalize(i.getItemName()) + "（歷史數量未知）").collect(Collectors.joining("、")));
        String activities = entry.getDowntimeActivities().stream().map(a -> normalize(a.getDescription())).filter(s -> !s.isEmpty()).collect(Collectors.joining("、"));
        if (!activities.isEmpty()) parts.add("休整：" + activities);
        String awards = entry.getStoryAwards().stream().map(a -> normalize(a.getAwardName())).filter(s -> !s.isEmpty()).collect(Collectors.joining("、"));
        if (!awards.isEmpty()) parts.add("故事獎勵：" + awards);
        return String.join("；", parts);
    }

    private static String normalize(String text) { return text == null ? "" : text.replaceAll("[\\p{Z}\\s\\p{Cc}]+", " ").strip(); }
    private static void put(Map<String, String> values, String key, Object value) { values.put(key, value == null ? "" : normalize(value.toString())); }
    private static String join(String... values) { return Arrays.stream(values).filter(Objects::nonNull).filter(s -> !s.isBlank()).collect(Collectors.joining(" / ")); }
    private static String number(Number value) { return value == null ? "—" : new BigDecimal(value.toString()).stripTrailingZeros().toPlainString(); }
    private static String sum(Number a, Number b) {
        if (a == null || b == null) return "—";
        var total = new BigDecimal(a.toString()).add(new BigDecimal(b.toString()));
        return (total.signum() > 0 ? "+" : "") + number(total);
    }
    private static boolean isNumericField(String name) { return name.matches("(Starting.*|Ending Level|Gold.*|Downtime.*|Magic Items|Total Permanent Magic Items|Soul Coins Carried|Sheet)(_\\d+)?"); }
    private static InputStream resource(String name) throws IOException {
        var stream = AdventurePdfWriter.class.getResourceAsStream("/export/" + name);
        if (stream == null) throw new IOException("缺少匯出資源：" + name);
        return stream;
    }

    private static final class Fonts {
        final PDType0Font text;
        final PDType0Font emoji;
        Fonts(PDDocument document) throws IOException {
            try (var tc = resource("NotoSansTC-Regular.ttf"); var em = resource("NotoEmoji-Regular.ttf")) {
                text = PDType0Font.load(document, tc); emoji = PDType0Font.load(document, em);
            }
        }
        private PDType0Font font(int codePoint) throws IOException {
            if (text.getCmapLookup().getGlyphId(codePoint) != 0) return text;
            if (emoji.getCmapLookup().getGlyphId(codePoint) != 0) return emoji;
            throw new BusinessException("PDF 字型無法顯示字元 U+" + Integer.toHexString(codePoint).toUpperCase(Locale.ROOT) + "，請改匯出 Excel");
        }
        private boolean invisible(int cp) { return cp == 0xfe0e || cp == 0xfe0f || cp == 0x200d; }
        float width(String value, float size) throws IOException {
            float result = 0;
            for (int cp : value.codePoints().toArray()) if (!invisible(cp)) result += font(cp).getStringWidth(new String(Character.toChars(cp))) * size / 1000;
            return result;
        }
        String fit(String value, float max, float size) throws IOException {
            var matcher = GRAPHEME.matcher(value);
            StringBuilder fitted = new StringBuilder();
            float used = 0;
            while (matcher.find()) {
                String next = matcher.group();
                float advance = width(next, size);
                if (used + advance > max) {
                    while (!fitted.isEmpty() && width(fitted + "…", size) > max) {
                        var glyphs = GRAPHEME.matcher(fitted).results().map(r -> r.group()).toList();
                        fitted.setLength(fitted.length() - glyphs.get(glyphs.size() - 1).length());
                    }
                    return width("…", size) <= max ? fitted + "…" : "";
                }
                fitted.append(next); used += advance;
            }
            return fitted.toString();
        }
        List<String> notes(String value, float[] widths) throws IOException {
            var glyphs = GRAPHEME.matcher(value).results().limit(121).map(r -> r.group()).toList();
            int keep = Math.min(120, glyphs.size());
            boolean truncated = glyphs.size() > 120;
            while (true) {
                String candidate = String.join("", glyphs.subList(0, Math.min(keep, truncated ? 119 : 120))) + (truncated ? "…" : "");
                List<String> lines = wrap(candidate, widths);
                if (lines != null) return lines;
                truncated = true;
                keep = Math.min(keep - 1, 119);
                if (keep < 0) throw new IOException("PDF 備註欄位寬度不足");
            }
        }
        private List<String> wrap(String value, float[] widths) throws IOException {
            List<String> lines = new ArrayList<>();
            StringBuilder line = new StringBuilder();
            var matcher = GRAPHEME.matcher(value);
            float used = 0;
            while (matcher.find()) {
                String glyph = matcher.group();
                float advance = width(glyph, 11);
                if (used + advance > widths[lines.size()]) {
                    if (lines.size() == 2) return null;
                    // Keep closing punctuation with the preceding character at a line break.
                    String carry = "";
                    if ("、，。；：！？）》】」』…".contains(glyph) && !line.isEmpty()) {
                        var previous = GRAPHEME.matcher(line).results().map(r -> r.group()).toList();
                        carry = previous.get(previous.size() - 1);
                        line.setLength(line.length() - carry.length());
                    }
                    lines.add(line.toString()); line.setLength(0); line.append(carry); used = width(carry, 11);
                }
                line.append(glyph); used += advance;
                if (used > widths[lines.size()]) return null;
            }
            lines.add(line.toString());
            return lines;
        }
        void draw(PDPageContentStream stream, String value, float size, float x, float y) throws IOException {
            stream.beginText(); stream.newLineAtOffset(x, y); stream.setNonStrokingColor(0f);
            PDType0Font current = null;
            StringBuilder run = new StringBuilder();
            for (int cp : value.codePoints().toArray()) if (!invisible(cp)) {
                var selected = font(cp);
                if (current != selected && !run.isEmpty()) {
                    stream.setFont(current, size); stream.showText(run.toString()); run.setLength(0);
                }
                current = selected; run.appendCodePoint(cp);
            }
            if (!run.isEmpty()) { stream.setFont(current, size); stream.showText(run.toString()); }
            stream.endText();
        }
    }
}
