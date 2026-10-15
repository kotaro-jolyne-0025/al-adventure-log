import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CharacterService } from './character.service';
import { LocalStore } from './local-store.service';

describe('Character mutation refresh ordering', () => {
  it('keeps the request started by reading-page refresh alive after all caches retire', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const characters = TestBed.inject(CharacterService);
    const local = TestBed.inject(LocalStore);
    const http = TestBed.inject(HttpTestingController);
    local.setOwner('a');
    vi.spyOn(local, 'invalidate').mockImplementation(() => local.markFresh('c', false));
    characters.getById('c').subscribe();
    const old = http.expectOne(request => request.url.endsWith('/characters/c'));
    let name = '';
    local.changes.subscribe(() => {
      expect(local.freshCharacters().has('c')).toBe(false);
      characters.getById('c', true).subscribe(value => { name = value.characterName; });
    });
    characters.notifyCharacterChanged('c');
    expect(old.cancelled).toBe(true);
    const latest = http.expectOne(request => request.url.endsWith('/characters/c'));
    expect(latest.cancelled).toBe(false);
    latest.flush({ id: 'c', characterName: '更新角色' });
    expect(name).toBe('更新角色');
    http.verify();
  });
});
