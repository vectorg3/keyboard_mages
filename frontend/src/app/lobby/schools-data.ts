export interface SchoolOption {
  id: string;
  label: string;
  /** Имя файла в public/school-icons/ без расширения — не всегда совпадает с id
   *  (например, лёд называется 'ice' у бэкенда, но иконка называется 'frost.png'). */
  icon: string;
}

export const SCHOOL_OPTIONS: SchoolOption[] = [
  { id: 'fire', label: 'Fire', icon: 'fire' },
  { id: 'ice', label: 'Frost', icon: 'frost' },
  { id: 'arcane', label: 'Arcane', icon: 'arcane' },
  { id: 'chaos', label: 'Chaos', icon: 'chaos' },
  { id: 'nature', label: 'Nature', icon: 'nature' },
];
