/** Секунды с одним знаком после запятой — для таймера поверх заблюренной кнопки заклинания
 *  и для таймера на иконке активного эффекта (Character и Match). */
export function formatCooldown(remainingMs: number): string {
  return (remainingMs / 1000).toFixed(1);
}

/** Путь к иконке заклинания в public/spell-icons/{school}/ — папка школы определяется
 *  префиксом id (например, 'fire_blaze' → 'fire'). */
export function spellIconPath(spellId: string): string {
  return `/spell-icons/${spellId.split('_')[0]}/${spellId}.png`;
}
