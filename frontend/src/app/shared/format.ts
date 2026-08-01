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

/** Путь к звуку каста в public/sounds/spells/{school}/ — та же схема, что у spellIconPath. */
export function spellSoundPath(spellId: string): string {
  return `/sounds/spells/${spellId.split('_')[0]}/${spellId}.ogg`;
}

/** Путь к зацикленному звуку ввода триггера в public/sounds/casting/ — один файл на школу
 *  (не на конкретное заклинание, в отличие от spellSoundPath). */
export function castingSoundPath(school: string): string {
  return `/sounds/casting/${school}.ogg`;
}

/** Буква → номер файла в public/ui/keyboard/{Keyboard,Keyboard Press}/Letters/L. Key {N}.png —
 *  файлы идут по алфавиту 1=A..25=Z, НО без буквы V (в паке её не было). 26 — вручную
 *  дорисованный спрайт V (тем же пером/палитрой/рамкой, что и остальные буквы; см. историю
 *  генерации в scratchpad), добавлен в обе папки (Keyboard и Keyboard Press) как file 26. */
const LETTER_KEY_INDEX: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 26,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

/** Путь к спрайту клавиши-буквы в public/ui/keyboard/ — pressed переключает между папками
 *  Keyboard (отжата) и Keyboard Press (нажата), это отдельные файлы, а не кадры одного листа
 *  (в отличие от старого набора public/ui/keys/). Регистр буквы не важен. Пробелы в пути
 *  (папка "Keyboard Press", файл "L. Key N.png") экранированы как %20 — иначе url() в CSS
 *  обрывает путь на первом пробеле. */
export function keySpritePath(char: string, pressed: boolean): string {
  const index = LETTER_KEY_INDEX[char.toUpperCase()];
  const folder = pressed ? 'Keyboard%20Press' : 'Keyboard';
  return `/ui/keyboard/${folder}/Letters/L.%20Key%20${index}.png`;
}

/** Прогревает браузерный кэш всеми 52 спрайтами клавиш (26 букв × отжата/нажата) сразу при
 *  старте приложения — без этого браузер запрашивает background-image только в момент, когда
 *  элемент с ним впервые попадает в разметку (title-заголовок уже показывает часть букв с самой
 *  загрузки страницы, но не "нажатое" состояние — оно нужно только внутри активного боя, и без
 *  прогрева каждая новая буква триггера догружается с нуля прямо посреди матча, из-за чего
 *  клавиши в .cast-window-chars на глаз "долетают" с задержкой). new Image() достаточно: сам факт
 *  простановки .src запускает загрузку и кладёт результат в HTTP/memory cache браузера, на
 *  переменную ссылаться дальше не нужно — достаточно, что GC не тронет её до конца загрузки. */
export function preloadKeySprites(): void {
  for (const char of Object.keys(LETTER_KEY_INDEX)) {
    for (const pressed of [false, true]) {
      const img = new Image();
      img.src = keySpritePath(char, pressed);
    }
  }
}
