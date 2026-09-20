import { DND_CLASSES, canonicalClassName, formatClassLevels, parseClassLevels } from './dnd-classes';

describe('D&D class identifiers', () => {
  it('uses English identifiers for localized and legacy form values', () => {
    expect(parseClassLevels('野蠻人1/戰士 (Fighter)2')).toEqual([
      { className: 'Barbarian', level: 1 },
      { className: 'Fighter', level: 2 },
    ]);
    expect(canonicalClassName('邪術士')).toBe('Warlock');
  });

  it('renders English and legacy identifiers with the localized label', () => {
    expect(formatClassLevels('Warlock3/邪術士1')).toBe('契術師 Lv.3 / 契術師 Lv.1');
  });

  it('keeps the Warlock API identifier independent from its display label', () => {
    expect(DND_CLASSES.find(item => item.id === 'Warlock')).toEqual({ id: 'Warlock', label: '契術師' });
  });
});
