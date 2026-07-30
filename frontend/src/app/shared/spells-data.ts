export interface SpellButtonData {
  id: string;
  name: string;
  trigger: string;
  /** 1 = Basic, 2 = Advanced, 3 = Ultimate — совпадает с backend SpellTier. Используется для
   *  цветной обводки кнопки в бою (синяя/фиолетовая/золотая). */
  tier: 1 | 2 | 3;
  description: string;
  /** Диапазон урона как строка для отображения ("6–8"), либо null для не-атакующих заклинаний. */
  damage: string | null;
  /** Краткое описание накладываемого эффекта, либо null, если его нет. */
  effect: string | null;
  cooldownSec: number;
}

/**
 * Данные для отображения заклинаний (кнопки каста + спеллбук на главном экране) — только то,
 * что нужно клиенту для рендера. Игровая логика (урон, эффекты, кулдауны) остаётся только на
 * бэкенде (backend/src/spells/spell-roster.ts) — это не полная копия, а именно её проекция.
 * Порядок внутри школы = порядок кнопок и горячих клавиш (1..N) в бою. Заполнено для школ,
 * у которых уже готовы иконки в public/spell-icons/.
 */
export const SPELL_BUTTONS_BY_SCHOOL: Record<string, SpellButtonData[]> = {
  fire: [
    {
      id: 'fire_spark',
      name: 'Spark',
      trigger: 'spark',
      tier: 1,
      description: 'Небольшая искра, малый прямой урон',
      damage: '6–8',
      effect: null,
      cooldownSec: 2,
    },
    {
      id: 'fire_ember_ward',
      name: 'Ember Ward',
      trigger: 'guard',
      tier: 1,
      description: 'Огненная плёнка, снижает входящий урон',
      damage: null,
      effect: 'Снижает входящий урон на 25% (1.5 сек)',
      cooldownSec: 2,
    },
    {
      id: 'fire_blaze',
      name: 'Blaze',
      trigger: 'inferno',
      tier: 2,
      description: 'Вспышка пламени + поджог',
      damage: '10–12',
      effect: 'Поджог: 2 урона/сек (3 сек)',
      cooldownSec: 4,
    },
    {
      id: 'fire_phoenix_rebirth',
      name: 'Phoenix Rebirth',
      trigger: 'phoenixrise',
      tier: 3,
      description: 'Исцеление + временный щит от смертельного удара',
      damage: null,
      effect: 'Лечит на 25 HP; 4 сек не даёт умереть (выживание с 1 HP)',
      cooldownSec: 6,
    },
    {
      id: 'fire_inferno_storm',
      name: 'Inferno Storm',
      trigger: 'firestormrage',
      tier: 3,
      description: 'Мощный взрыв, максимальный прямой урон школы + поджог',
      damage: '20–24',
      effect: 'Поджог: 4 урона/сек (3 сек)',
      cooldownSec: 6,
    },
  ],
  ice: [
    {
      id: 'ice_frostbite',
      name: 'Frostbite',
      trigger: 'frost',
      tier: 1,
      description: 'Малый урон + лёгкое замедление ввода соперника',
      damage: '4–6',
      effect: 'Замедляет ввод соперника на 20% (1 сек)',
      cooldownSec: 2,
    },
    {
      id: 'ice_winters_grasp',
      name: "Winter's Grasp",
      trigger: 'chill',
      tier: 1,
      description: 'Замедляет восстановление кулдауна соперника',
      damage: null,
      effect: 'Кулдаун соперника длиннее на 30% (4 сек)',
      cooldownSec: 2,
    },
    {
      id: 'ice_ice_shard',
      name: 'Ice Shard',
      trigger: 'iceshard',
      tier: 2,
      description: 'Средний урон + краткое замедление ввода соперника',
      damage: '11–15',
      effect: 'Замедляет ввод соперника на 30% (1.5 сек)',
      cooldownSec: 4,
    },
    {
      id: 'ice_frozen_armor',
      name: 'Frozen Armor',
      trigger: 'glacierwall',
      tier: 2,
      description: 'Ледяной щит: поглощение + лёгкое отражение',
      damage: null,
      effect: 'Поглощает 15 урона (6 сек), 20% поглощённого отражается атакующему',
      cooldownSec: 4,
    },
    {
      id: 'ice_blizzard',
      name: 'Blizzard',
      trigger: 'absolutezero',
      tier: 3,
      description: 'Крупный урон + сильное замедление',
      damage: '32–36',
      effect: 'Замедляет ввод соперника на 40% (3 сек)',
      cooldownSec: 6,
    },
  ],
  arcane: [
    {
      id: 'arcane_arcane_blast',
      name: 'Arcane Blast',
      trigger: 'blast',
      tier: 1,
      description: 'Стабильный урон без побочных эффектов',
      damage: '6–8',
      effect: null,
      cooldownSec: 2,
    },
    {
      id: 'arcane_power_rune',
      name: 'Power Rune',
      trigger: 'power',
      tier: 1,
      description: 'Усиливает исходящий урон заклинателя',
      damage: null,
      effect: 'Усиливает свой исходящий урон на 15% (2 сек)',
      cooldownSec: 2,
    },
    {
      id: 'arcane_arcane_missile',
      name: 'Arcane Missile',
      trigger: 'starfall',
      tier: 2,
      description: 'Урон, игнорирующий эффекты снижения урона',
      damage: '12–14',
      effect: 'Игнорирует снижение входящего урона у цели',
      cooldownSec: 4,
    },
    {
      id: 'arcane_mirror_shield',
      name: 'Mirror Shield',
      trigger: 'reflectio',
      tier: 2,
      description: 'Отражает часть входящего урона',
      damage: null,
      effect: 'Отражает 20% каждого полученного удара (2.5 сек)',
      cooldownSec: 4,
    },
    {
      id: 'arcane_time_warp',
      name: 'Time Warp',
      trigger: 'chronoshift',
      tier: 3,
      description: 'Сбрасывает кулдаун заклинаний 2 и 3 тира своей школы',
      damage: null,
      effect: 'Обнуляет кулдаун заклинаний 2 и 3 тира своей школы',
      cooldownSec: 6,
    },
    {
      id: 'arcane_spellbreaker',
      name: 'Spellbreaker',
      trigger: 'spellbreaker',
      tier: 3,
      description: 'Крупный урон + усиление исходящего урона заклинателя',
      damage: '24–28',
      effect: 'Усиливает свой исходящий урон на 30% (4 сек)',
      cooldownSec: 6,
    },
  ],
  chaos: [
    {
      id: 'chaos_chaos_bolt',
      name: 'Chaos Bolt',
      trigger: 'chaos',
      tier: 1,
      description: 'Урон варьируется в широком диапазоне',
      damage: '4–12',
      effect: null,
      cooldownSec: 2,
    },
    {
      id: 'chaos_unstable_surge',
      name: 'Unstable Surge',
      trigger: 'wildmagic',
      tier: 2,
      description: 'Случайный эффект заклинателю: сопротивление, урон себе, или изменение урона в бою',
      damage: null,
      effect:
        'Случайно один из: сопротивление −30% (2 сек), усиление своего урона +20% (3 сек), ' +
        'периодический урон себе 3/сек (3 сек), или входящий урон себе +20% (3 сек)',
      cooldownSec: 4,
    },
    {
      id: 'chaos_entropy_veil',
      name: 'Entropy Veil',
      trigger: 'entropyveil',
      tier: 2,
      description: 'Случайно: полный блок с отражением заклинания ИЛИ рост входящего урона на 50%',
      damage: null,
      effect: 'Случайно: щит поглощает и отражает удар (2 сек), либо входящий урон себе +50% (2 сек)',
      cooldownSec: 4,
    },
    {
      id: 'chaos_corruption',
      name: 'Corruption',
      trigger: 'corruption',
      tier: 2,
      description: 'Урон + DoT на соперника со случайной длительностью',
      damage: '8–16',
      effect: 'Яд: 2 урона/сек, длительность случайна (1–3 сек)',
      cooldownSec: 4,
    },
    {
      id: 'chaos_void_collapse',
      name: 'Void Collapse',
      trigger: 'voidcollapse',
      tier: 3,
      description: 'Огромный урон, но увеличивает время восстановления следующего заклинания',
      damage: '30–40',
      effect: 'Увеличивает восстановление своего следующего заклинания на 3 сек',
      cooldownSec: 6,
    },
  ],
  nature: [
    {
      id: 'nature_vine_whip',
      name: 'Vine Whip',
      trigger: 'vine',
      tier: 1,
      description: 'Малый урон + блокирует случайное заклинание соперника на 1 секунду',
      damage: '4–6',
      effect: 'Блокирует случайное заклинание школы соперника на 1 сек',
      cooldownSec: 2,
    },
    {
      id: 'nature_bark_skin',
      name: 'Bark Skin',
      trigger: 'barkskin',
      tier: 1,
      description: 'Пассивное снижение урона на время действия',
      damage: null,
      effect: 'Снижает входящий урон на 25% (1.5 сек)',
      cooldownSec: 2,
    },
    {
      id: 'nature_entangle',
      name: 'Entangle',
      trigger: 'rootbind',
      tier: 2,
      description: 'Блокирует случайное заклинание соперника на 3 секунды',
      damage: null,
      effect: 'Блокирует случайное заклинание школы соперника на 3 сек',
      cooldownSec: 4,
    },
    {
      id: 'nature_regrowth',
      name: 'Regrowth',
      trigger: 'lifebloom',
      tier: 2,
      description: 'Восстанавливает HP заклинателю по 3 ед. каждую секунду в течение 2 секунд',
      damage: null,
      effect: 'Лечит на 3 HP каждую секунду (2 сек)',
      cooldownSec: 4,
    },
    {
      id: 'nature_natures_fury',
      name: "Nature's Fury",
      trigger: 'wildgrowthrage',
      tier: 3,
      description: 'Крупный урон + блокирует случайное заклинание соперника на 5 секунд',
      damage: '28–32',
      effect: 'Блокирует случайное заклинание школы соперника на 5 сек',
      cooldownSec: 6,
    },
    {
      id: 'nature_vampiric_roots',
      name: 'Vampiric Roots',
      trigger: 'vampiricroots',
      tier: 3,
      description: 'Крупный урон + восстанавливает HP заклинателю по 3 ед. каждую секунду в течение 4 секунд',
      damage: '28–32',
      effect: 'Лечит на 3 HP каждую секунду (4 сек)',
      cooldownSec: 6,
    },
  ],
};

/** Плоский индекс id → заклинание, по всем школам — для подсказки над иконкой активного
 *  эффекта (иконка эффекта = иконка заклинания-источника, см. раздел 7.25 game-design.md). */
export const SPELL_BY_ID: Record<string, SpellButtonData> = Object.fromEntries(
  Object.values(SPELL_BUTTONS_BY_SCHOOL)
    .flat()
    .map((spell) => [spell.id, spell]),
);
