import { Spell, SpellOnHitEffect, SpellSchool, SpellTier, SpellType } from './spell.types';

// Значения по умолчанию из раздела 5.2 game-design.md (середина диапазона каждого уровня)
const TIER_DEFAULTS: Record<
  SpellTier,
  { cooldownMs: number; castWindowMs: number }
> = {
  [SpellTier.Basic]: { cooldownMs: 2000, castWindowMs: 2000 },
  [SpellTier.Advanced]: { cooldownMs: 4000, castWindowMs: 3000 },
  [SpellTier.Ultimate]: { cooldownMs: 6000, castWindowMs: 4000 },
};

// Плейсхолдер урона для Attack-заклинаний, чей диапазон ещё не откалиброван индивидуально
// (см. раздел 7.6 game-design.md) — держит прежние фиксированные значения по тиру как
// временный flat-диапазон [v, v], до отдельного прохода баланса по каждому заклинанию.
const PLACEHOLDER_DAMAGE_BY_TIER: Record<SpellTier, { min: number; max: number }> = {
  [SpellTier.Basic]: { min: 8, max: 8 },
  [SpellTier.Advanced]: { min: 14, max: 14 },
  [SpellTier.Ultimate]: { min: 22, max: 22 },
};

function spell(
  id: string,
  name: string,
  trigger: string,
  school: SpellSchool,
  type: SpellType,
  tier: SpellTier,
  description: string,
  extra?: {
    damage?: [min: number, max: number];
    onHitEffect?: SpellOnHitEffect;
    randomEffectPool?: SpellOnHitEffect[];
    healOnCast?: number;
    ignoresDamageReduction?: boolean;
    disableRandomSpell?: { durationMs: number };
    resetsCooldownTiers?: SpellTier[];
  },
): Spell {
  const damage =
    type === SpellType.Attack
      ? extra?.damage
        ? { min: extra.damage[0], max: extra.damage[1] }
        : PLACEHOLDER_DAMAGE_BY_TIER[tier]
      : undefined;

  return {
    id,
    name,
    trigger,
    school,
    type,
    tier,
    description,
    ...TIER_DEFAULTS[tier],
    damage,
    onHitEffect: extra?.onHitEffect,
    randomEffectPool: extra?.randomEffectPool,
    healOnCast: extra?.healOnCast,
    ignoresDamageReduction: extra?.ignoresDamageReduction,
    disableRandomSpell: extra?.disableRandomSpell,
    resetsCooldownTiers: extra?.resetsCooldownTiers,
  };
}

export const SPELL_ROSTER: Spell[] = [
  // Fire
  spell(
    'fire_spark',
    'Spark',
    'spark',
    SpellSchool.Fire,
    SpellType.Attack,
    SpellTier.Basic,
    'Небольшая искра, малый прямой урон',
    { damage: [6, 8] },
  ),
  spell(
    'fire_ember_ward',
    'Ember Ward',
    'guard',
    SpellSchool.Fire,
    SpellType.Defense,
    SpellTier.Basic,
    'Огненная плёнка, снижает входящий урон',
    {
      onHitEffect: {
        type: 'damage_boost',
        target: 'self',
        // Отрицательный magnitude: тот же множитель (1 + magnitude), что и у атакующих
        // damage_boost-баффов, но применённый к себе — снижает, а не увеличивает урон.
        magnitude: -0.25,
        // Короче кулдауна (2000мс у Basic), иначе перекаст держал бы защиту 100% времени боя.
        durationMs: 1500,
        // Обязательно 'incoming' — иначе тот же множитель ошибочно ослаблял бы и СОБСТВЕННЫЙ
        // исходящий урон кастера, пока щит активен (см. раздел 7.17 game-design.md).
        damageDirection: 'incoming',
      },
    },
  ),
  spell(
    'fire_blaze',
    'Blaze',
    'inferno',
    SpellSchool.Fire,
    SpellType.Attack,
    SpellTier.Advanced,
    'Вспышка пламени + поджог (DoT 3 сек)',
    {
      damage: [10, 12],
      onHitEffect: {
        type: 'dot',
        magnitude: 2,
        durationMs: 3000,
        tickIntervalMs: 1000,
      },
    },
  ),
  spell(
    'fire_phoenix_rebirth',
    'Phoenix Rebirth',
    'phoenixrise',
    SpellSchool.Fire,
    SpellType.Support,
    SpellTier.Ultimate,
    'Исцеление + временный щит от смертельного удара',
    {
      healOnCast: 25,
      onHitEffect: {
        type: 'death_ward',
        target: 'self',
        magnitude: 1, // при смертельном ударе выживает с 1 HP вместо 0
        // Короче cooldownMs Ultimate-тира (6000, см. TIER_DEFAULTS) — по той же причине,
        // что и у Ember Ward: иначе перекаст держал бы "неуязвимость к смерти" 100% времени.
        durationMs: 4000,
      },
    },
  ),
  spell(
    'fire_inferno_storm',
    'Inferno Storm',
    'firestormrage',
    SpellSchool.Fire,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Мощный взрыв, максимальный прямой урон школы + поджог (DoT 3 сек)',
    {
      damage: [20, 24],
      onHitEffect: {
        type: 'dot',
        magnitude: 4,
        durationMs: 3000,
        tickIntervalMs: 1000,
      },
    },
  ),

  // Ice
  spell(
    'ice_frostbite',
    'Frostbite',
    'frost',
    SpellSchool.Ice,
    SpellType.Attack,
    SpellTier.Basic,
    'Малый урон + лёгкое замедление ввода соперника',
    {
      damage: [4, 6],
      onHitEffect: {
        type: 'slow',
        durationMs: 1000,
        // Отрицательный magnitude: множитель (1 + magnitude) должен УМЕНЬШАТЬ effectiveCastWindow
        // соперника (см. EffectsService.getEffectiveCastWindow), а не увеличивать его.
        magnitude: -0.2,
      },
    },
  ),
  spell(
    'ice_winters_grasp',
    "Winter's Grasp",
    'chill',
    SpellSchool.Ice,
    SpellType.Support,
    SpellTier.Basic,
    'Замедляет восстановление кулдауна соперника',
    {
      onHitEffect: {
        type: 'cooldown_reduction',
        // Положительный magnitude здесь УВЕЛИЧИВАЕТ effectiveCooldown соперника
        // (см. EffectsService.getEffectiveCooldown) — то есть замедляет, а не ускоряет его.
        magnitude: 0.3,
        durationMs: 4000,
      },
    },
  ),
  spell(
    'ice_ice_shard',
    'Ice Shard',
    'iceshard',
    SpellSchool.Ice,
    SpellType.Attack,
    SpellTier.Advanced,
    'Средний урон + краткое замедление ввода соперника',
    {
      damage: [11, 15],
      onHitEffect: {
        type: 'slow',
        // Сильнее, чем у Frostbite (Basic), т.к. Ice Shard — Advanced-заклинание.
        magnitude: -0.3,
        durationMs: 1500,
      },
    },
  ),
  spell(
    'ice_frozen_armor',
    'Frozen Armor',
    'glacierwall',
    SpellSchool.Ice,
    SpellType.Defense,
    SpellTier.Advanced,
    'Ледяной щит: поглощение + лёгкое отражение',
    {
      onHitEffect: {
        type: 'shield',
        target: 'self',
        magnitude: 15, // пул поглощения, HP
        durationMs: 6000,
        reflectRatio: 0.2, // лёгкое отражение: 20% поглощённого урона возвращается атакующему
      },
    },
  ),
  spell(
    'ice_blizzard',
    'Blizzard',
    'absolutezero',
    SpellSchool.Ice,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Крупный урон + сильное замедление',
    {
      damage: [32, 36],
      onHitEffect: {
        type: 'slow',
        // Отрицательный magnitude сокращает effectiveCastWindow соперника (см. Frostbite/Ice
        // Shard) — сила замедления 0.4, сильнее обоих предыдущих, т.к. Blizzard — Ultimate.
        magnitude: -0.4,
        durationMs: 3000,
      },
    },
  ),

  // Arcane
  spell(
    'arcane_arcane_blast',
    'Arcane Blast',
    'blast',
    SpellSchool.Arcane,
    SpellType.Attack,
    SpellTier.Basic,
    'Стабильный урон без побочных эффектов',
    { damage: [6, 8] },
  ),
  spell(
    'arcane_power_rune',
    'Power Rune',
    'power',
    SpellSchool.Arcane,
    SpellType.Support,
    SpellTier.Basic,
    'Усиливает исходящий урон заклинателя',
    {
      onHitEffect: {
        type: 'damage_boost',
        target: 'self',
        magnitude: 0.15,
        durationMs: 2000,
        damageDirection: 'outgoing',
      },
    },
  ),
  spell(
    'arcane_arcane_missile',
    'Arcane Missile',
    'starfall',
    SpellSchool.Arcane,
    SpellType.Attack,
    SpellTier.Advanced,
    'Урон, игнорирующий эффекты снижения урона',
    { damage: [12, 14], ignoresDamageReduction: true },
  ),
  spell(
    'arcane_mirror_shield',
    'Mirror Shield',
    'reflectio',
    SpellSchool.Arcane,
    SpellType.Defense,
    SpellTier.Advanced,
    'Отражает часть входящего урона',
    {
      onHitEffect: {
        type: 'reflect',
        target: 'self',
        magnitude: 0.2,
        durationMs: 2500,
      },
    },
  ),
  spell(
    'arcane_time_warp',
    'Time Warp',
    'chronoshift',
    SpellSchool.Arcane,
    SpellType.Support,
    SpellTier.Ultimate,
    'Сбрасывает кулдаун заклинаний 2 и 3 тира своей школы',
    { resetsCooldownTiers: [SpellTier.Advanced, SpellTier.Ultimate] },
  ),
  spell(
    'arcane_spellbreaker',
    'Spellbreaker',
    'spellbreaker',
    SpellSchool.Arcane,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Крупный урон + усиление исходящего урона заклинателя',
    {
      damage: [24, 28],
      onHitEffect: {
        type: 'damage_boost',
        target: 'self',
        magnitude: 0.3,
        durationMs: 4000,
        damageDirection: 'outgoing',
      },
    },
  ),

  // Chaos
  spell(
    'chaos_chaos_bolt',
    'Chaos Bolt',
    'chaos',
    SpellSchool.Chaos,
    SpellType.Attack,
    SpellTier.Basic,
    'Урон варьируется в широком диапазоне',
    { damage: [4, 12] },
  ),
  spell(
    'chaos_unstable_surge',
    'Unstable Surge',
    'wildmagic',
    SpellSchool.Chaos,
    SpellType.Support,
    SpellTier.Advanced,
    'Случайный эффект заклинателю: сопротивление, урон себе, или изменение урона в бою',
    {
      randomEffectPool: [
        // Сопротивление 30% на 2 сек — снижает входящий урон.
        {
          type: 'damage_boost',
          target: 'self',
          magnitude: -0.3,
          durationMs: 2000,
          damageDirection: 'incoming',
        },
        // Усиление исходящего урона на 20% на 3 сек.
        {
          type: 'damage_boost',
          target: 'self',
          magnitude: 0.2,
          durationMs: 3000,
          damageDirection: 'outgoing',
        },
        // Хаотичная магия бьёт по самому заклинателю: 3 урона/тик, 3 тика за 3 сек.
        {
          type: 'dot',
          target: 'self',
          magnitude: 3,
          durationMs: 3000,
          tickIntervalMs: 1000,
        },
        // Усиление ВХОДЯЩЕГО урона на 20% на 3 сек — тоже себе, тоже случайный откат.
        {
          type: 'damage_boost',
          target: 'self',
          magnitude: 0.2,
          durationMs: 3000,
          damageDirection: 'incoming',
        },
      ],
    },
  ),
  spell(
    'chaos_entropy_veil',
    'Entropy Veil',
    'entropyveil',
    SpellSchool.Chaos,
    SpellType.Defense,
    SpellTier.Advanced,
    'Случайно: полный блок с отражением заклинания ИЛИ рост входящего урона на 50%',
    {
      randomEffectPool: [
        // "Отражает заклинание": пул поглощения с запасом на любой одиночный удар (999 —
        // заведомо больше максимального урона в игре) + 100% урона возвращается атакующему.
        // Формально живёт 2 сек и МОЖЕТ поглотить больше одного удара, если оба попадут в
        // это окно — приближение к "одному заклинанию", а не строгая гарантия ровно одного.
        {
          type: 'shield',
          target: 'self',
          magnitude: 999,
          durationMs: 2000,
          reflectRatio: 1,
        },
        {
          type: 'damage_boost',
          target: 'self',
          magnitude: 0.5,
          durationMs: 2000,
          damageDirection: 'incoming',
        },
      ],
    },
  ),
  spell(
    'chaos_corruption',
    'Corruption',
    'corruption',
    SpellSchool.Chaos,
    SpellType.Attack,
    SpellTier.Advanced,
    'Урон + DoT на соперника со случайной длительностью',
    {
      damage: [8, 16],
      onHitEffect: {
        type: 'dot',
        magnitude: 2,
        durationRange: [1000, 3000],
        tickIntervalMs: 1000,
      },
    },
  ),
  spell(
    'chaos_void_collapse',
    'Void Collapse',
    'voidcollapse',
    SpellSchool.Chaos,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Огромный урон, но увеличивает время восстановления следующего заклинания',
    {
      damage: [30, 40],
      onHitEffect: {
        type: 'cooldown_delay',
        target: 'self',
        magnitude: 3000,
        // Защитный потолок на случай, если игрок долго не кастует снова — просто истечёт,
        // не будучи применённым. Расходуется (см. duel.service.ts) при следующем успешном
        // касте, так что реальное durationMs почти всегда не имеет значения.
        durationMs: 15000,
      },
    },
  ),

  // Nature
  spell(
    'nature_vine_whip',
    'Vine Whip',
    'vine',
    SpellSchool.Nature,
    SpellType.Attack,
    SpellTier.Basic,
    'Малый урон + блокирует случайное заклинание соперника на 1 секунду',
    { damage: [4, 6], disableRandomSpell: { durationMs: 1000 } },
  ),
  spell(
    'nature_bark_skin',
    'Bark Skin',
    'barkskin',
    SpellSchool.Nature,
    SpellType.Defense,
    SpellTier.Basic,
    'Пассивное снижение урона на время действия',
    {
      // В точности как Ember Ward (fire_ember_ward) — тот же самобаф снижения входящего урона.
      onHitEffect: {
        type: 'damage_boost',
        target: 'self',
        magnitude: -0.25,
        durationMs: 1500,
        damageDirection: 'incoming',
      },
    },
  ),
  spell(
    'nature_entangle',
    'Entangle',
    'rootbind',
    SpellSchool.Nature,
    SpellType.Support,
    SpellTier.Advanced,
    'Блокирует случайное заклинание соперника на 3 секунды',
    { disableRandomSpell: { durationMs: 3000 } },
  ),
  spell(
    'nature_regrowth',
    'Regrowth',
    'lifebloom',
    SpellSchool.Nature,
    SpellType.Support,
    SpellTier.Advanced,
    'Восстанавливает HP заклинателю по 3 ед. каждую секунду в течение 2 секунд',
    {
      onHitEffect: {
        type: 'hot',
        target: 'self',
        magnitude: 3,
        durationMs: 2000,
        tickIntervalMs: 1000,
      },
    },
  ),
  spell(
    'nature_natures_fury',
    "Nature's Fury",
    'wildgrowthrage',
    SpellSchool.Nature,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Крупный урон + блокирует случайное заклинание соперника на 5 секунд',
    { damage: [28, 32], disableRandomSpell: { durationMs: 5000 } },
  ),
  spell(
    'nature_vampiric_roots',
    'Vampiric Roots',
    'vampiricroots',
    SpellSchool.Nature,
    SpellType.Attack,
    SpellTier.Ultimate,
    'Крупный урон + восстанавливает HP заклинателю по 3 ед. каждую секунду в течение 4 секунд',
    {
      damage: [28, 32],
      onHitEffect: {
        type: 'hot',
        target: 'self',
        magnitude: 3,
        durationMs: 4000,
        tickIntervalMs: 1000,
      },
    },
  ),
];
