# Export resources

- `adventure-log-template.pdf` is the user supplied 冒險紀錄表.pdf, copied without modification. SHA-256: `7f92c6298fa23f78ca2334a642b1f9552e0f039977e22c452c8d1c7fd3f5e3b9`.
- The original first page is repeated (three entries/page). Header fields use their original names; entry fields use no suffix, `_2`, `_3`. The three note lines are `Adventure NotesDowntime Activity 1`, `Adventure NotesDowntime Activity 2`, `undefined`. Runtime checks assert the original field counts; automated tests verify rectangles and page artwork.
- `NotoSansTC-Regular.ttf`: static weight 400 instance of [Google Fonts Noto Sans TC](https://github.com/google/fonts/blob/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf).
- `NotoEmoji-Regular.ttf`: static weight 400 instance of [Google Fonts Noto Emoji](https://github.com/google/fonts/blob/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf), used for glyph fallback.
- Both static instances were generated using fontTools `instantiateVariableFont(font, {'wght': 400}, inplace=True)`. Corresponding OFL license notices are included alongside the fonts. Fonts are embedded locally; exports perform no network requests.
