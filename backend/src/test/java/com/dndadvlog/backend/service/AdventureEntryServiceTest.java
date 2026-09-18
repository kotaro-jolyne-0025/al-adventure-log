package com.dndadvlog.backend.service;

import com.dndadvlog.backend.dto.AdventureEntryResponse;
import com.dndadvlog.backend.entity.AdventureEntry;
import com.dndadvlog.backend.entity.DowntimeActivity;
import com.dndadvlog.backend.entity.StoryAward;
import com.dndadvlog.backend.mapper.AdventureEntryMapper;
import com.dndadvlog.backend.mapper.AdventureGainedItemMapper;
import com.dndadvlog.backend.mapper.CharacterMapper;
import com.dndadvlog.backend.mapper.DowntimeActivityMapper;
import com.dndadvlog.backend.mapper.InventoryItemMapper;
import com.dndadvlog.backend.mapper.StoryAwardMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdventureEntryServiceTest {

    @Mock
    private AdventureEntryMapper entryMapper;
    @Mock
    private CharacterMapper characterMapper;
    @Mock
    private DowntimeActivityMapper downtimeActivityMapper;
    @Mock
    private AdventureGainedItemMapper gainedItemMapper;
    @Mock
    private StoryAwardMapper storyAwardMapper;
    @Mock
    private CharacterService characterService;
    @Mock
    private InventoryItemMapper inventoryItemMapper;

    @InjectMocks
    private AdventureEntryService service;

    @Test
    void getEntriesByCharacterLoadsChildrenInTwoBatchQueries() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AdventureEntry first = entry(UUID.randomUUID());
        AdventureEntry second = entry(UUID.randomUUID());
        List<UUID> entryIds = List.of(first.getId(), second.getId());

        DowntimeActivity activity = new DowntimeActivity();
        activity.setAdventureEntryId(first.getId());
        StoryAward award = new StoryAward();
        award.setAdventureEntryId(second.getId());

        when(entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId))
                .thenReturn(List.of(first, second));
        when(downtimeActivityMapper.findByEntryIds(entryIds)).thenReturn(List.of(activity));
        when(storyAwardMapper.findByAdventureEntryIds(entryIds)).thenReturn(List.of(award));

        List<AdventureEntryResponse> responses = service.getEntriesByCharacter(characterId, userId);

        assertEquals(2, responses.size());
        assertEquals(1, responses.get(0).getDowntimeActivities().size());
        assertEquals(0, responses.get(0).getStoryAwards().size());
        assertEquals(0, responses.get(1).getDowntimeActivities().size());
        assertEquals(1, responses.get(1).getStoryAwards().size());
        verify(downtimeActivityMapper).findByEntryIds(entryIds);
        verify(storyAwardMapper).findByAdventureEntryIds(entryIds);
        verify(downtimeActivityMapper, never()).findByEntryIdOrderByCreatedAtAsc(first.getId());
        verify(downtimeActivityMapper, never()).findByEntryIdOrderByCreatedAtAsc(second.getId());
        verify(storyAwardMapper, never()).findByAdventureEntryId(first.getId());
        verify(storyAwardMapper, never()).findByAdventureEntryId(second.getId());
    }

    @Test
    void getEntriesByCharacterSkipsChildQueriesWhenThereAreNoEntries() {
        UUID characterId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(entryMapper.findByCharacterIdOrderByPlayDateAsc(characterId)).thenReturn(List.of());

        List<AdventureEntryResponse> responses = service.getEntriesByCharacter(characterId, userId);

        assertEquals(0, responses.size());
        verify(downtimeActivityMapper, never()).findByEntryIds(anyList());
        verify(storyAwardMapper, never()).findByAdventureEntryIds(anyList());
    }

    private AdventureEntry entry(UUID id) {
        AdventureEntry entry = new AdventureEntry();
        entry.setId(id);
        return entry;
    }
}
