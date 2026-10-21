package com.dndadvlog.backend.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** Internal export data; controllers return only the generated file. */
public record AdventureExportSnapshot(CharacterResponse character, OffsetDateTime exportedAt,
                                      List<AdventureEntryResponse> entries) {}
