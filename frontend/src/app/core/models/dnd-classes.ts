export interface DndClassOption {
  id: string;
  label: string;
}

// Persist/API identifiers stay English; these labels can be localized independently.
export const DND_CLASSES: DndClassOption[] = [
  { id: 'Barbarian', label: '野蠻人' },
  { id: 'Bard', label: '吟遊詩人' },
  { id: 'Cleric', label: '牧師' },
  { id: 'Druid', label: '德魯伊' },
  { id: 'Fighter', label: '戰士' },
  { id: 'Monk', label: '武僧' },
  { id: 'Paladin', label: '聖騎士' },
  { id: 'Ranger', label: '遊俠' },
  { id: 'Rogue', label: '遊蕩者' },
  { id: 'Sorcerer', label: '術士' },
  { id: 'Warlock', label: '契術師' },
  { id: 'Wizard', label: '法師' },
  { id: 'Artificer', label: '奇械師' },
];

const aliases = new Map<string, string>([
  ['野蠻人', 'Barbarian'], ['吟遊詩人', 'Bard'], ['牧師', 'Cleric'],
  ['德魯伊', 'Druid'], ['戰士', 'Fighter'], ['武僧', 'Monk'],
  ['聖騎士', 'Paladin'], ['遊俠', 'Ranger'], ['遊蕩者', 'Rogue'], ['盜賊', 'Rogue'],
  ['術士', 'Sorcerer'], ['邪術士', 'Warlock'], ['契術師', 'Warlock'],
  ['法師', 'Wizard'], ['奇械師', 'Artificer'], ['奇術師', 'Artificer'],
]);
const labels = new Map(DND_CLASSES.map(({ id, label }) => [id, label]));

export function canonicalClassName(name: string): string {
  const value = name.trim();
  const alias = value.match(/^(.+?)\s*\(([^)]+)\)$/);
  const english = alias?.[2]?.trim();
  if (english && labels.has(english)) return english;
  return labels.has(value) ? value : aliases.get(value) ?? value;
}

export function parseClassLevels(value?: string | null): { className: string; level: number }[] {
  if (!value?.trim()) return [];
  return value.split('/').map(segment => {
    const match = segment.trim().match(/^(.+?)(\d+)$/);
    return match
      ? { className: canonicalClassName(match[1]), level: Number(match[2]) }
      : { className: canonicalClassName(segment), level: 1 };
  }).filter(item => item.className);
}

export function formatClassLevels(value?: string | null, separator = ' / '): string {
  return parseClassLevels(value)
    .map(({ className, level }) => `${labels.get(className) ?? className} Lv.${level}`)
    .join(separator);
}
