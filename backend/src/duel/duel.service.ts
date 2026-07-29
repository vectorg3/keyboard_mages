import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EffectsService } from '../effects/effects.service';
import { SpellsService } from '../spells/spells.service';
import { SpellSchool, SpellTier, SpellType } from '../spells/spell.types';
import {
  ActiveCast,
  CastResolution,
  KeyInputResult,
  MatchState,
  PlayerState,
} from './duel.types';

export const MAX_HP = 100;

// Пауза между match_found и стартом боя (см. раздел 7.5 game-design.md): даёт клиентам
// время отрисовать сцену/арену до того, как разрешены первые касты.
const PRE_MATCH_DELAY_MS = 3000;

/** Случайное целое из диапазона урона заклинания (границы включительно). */
function rollDamage(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

@Injectable()
export class DuelService {
  private readonly logger = new Logger(DuelService.name);
  private readonly matches = new Map<string, MatchState>();

  constructor(
    private readonly spellsService: SpellsService,
    private readonly effectsService: EffectsService,
  ) {}

  createMatch(
    playerAId: string,
    playerASchool: SpellSchool,
    playerBId: string,
    playerBSchool: SpellSchool,
    now = Date.now(),
  ): MatchState {
    const match: MatchState = {
      matchId: randomUUID(),
      playerIds: [playerAId, playerBId],
      players: {
        [playerAId]: this.createPlayerState(playerAId, playerASchool),
        [playerBId]: this.createPlayerState(playerBId, playerBSchool),
      },
      effects: [],
      createdAt: now,
      startsAt: now + PRE_MATCH_DELAY_MS,
      finishedAt: null,
      winnerId: null,
    };
    this.matches.set(match.matchId, match);
    return match;
  }

  getMatch(matchId: string): MatchState | undefined {
    return this.matches.get(matchId);
  }

  removeMatch(matchId: string): void {
    this.matches.delete(matchId);
  }

  /**
   * Технический проигрыш — при дисконнекте игрока в бою (см. DuelGateway.handleDisconnect,
   * TODO там снят). Не трогает уже завершённый матч (двойной дисконнект/дисконнект после
   * победы по HP не должен переписывать реального победителя).
   */
  forfeitMatch(matchId: string, loserId: string, now = Date.now()): void {
    const match = this.matches.get(matchId);
    if (!match || match.finishedAt) return;
    match.finishedAt = now;
    match.winnerId = this.opponentId(match, loserId);
  }

  private createPlayerState(playerId: string, school: SpellSchool): PlayerState {
    return {
      playerId,
      school,
      hp: MAX_HP,
      cooldowns: {},
      activeCast: null,
      silencedSpellId: null,
    };
  }

  private opponentId(match: MatchState, playerId: string): string {
    const [a, b] = match.playerIds;
    return a === playerId ? b : a;
  }

  private effectsOn(match: MatchState, playerId: string) {
    return match.effects.filter((e) => e.targetPlayerId === playerId);
  }

  /**
   * Эффекты playerId, годные для расчёта урона в роли 'outgoing' (playerId атакует) или
   * 'incoming' (playerId получает удар). Только damage_boost чувствителен к направлению —
   * остальные типы эффектов combinedMultiplier всё равно игнорирует, так что они проходят как
   * есть. Отсутствие damageDirection считается "работает в обе стороны" — совместимость назад.
   */
  private effectsForDamageRole(
    match: MatchState,
    playerId: string,
    role: 'outgoing' | 'incoming',
  ) {
    return this.effectsOn(match, playerId).filter(
      (e) =>
        e.effectType !== 'damage_boost' ||
        e.damageDirection === undefined ||
        e.damageDirection === role,
    );
  }

  /**
   * Наносит урон игроку. Если удар смертельный и у игрока активен death_ward
   * (Phoenix Rebirth), вместо смерти оставляет его с magnitude HP и расходует эффект —
   * единственное место, где HP уменьшается, чтобы это правило работало для любого
   * источника урона (прямой удар, отражение щитом, DoT-тик).
   */
  private applyDamage(match: MatchState, playerId: string, amount: number): void {
    const player = match.players[playerId];
    if (!player || amount <= 0) return;

    if (player.hp - amount <= 0) {
      const ward = this.effectsOn(match, playerId).find(
        (e) => e.effectType === 'death_ward',
      );
      if (ward) {
        player.hp = ward.magnitude;
        match.effects = match.effects.filter((e) => e.id !== ward.id);
        return;
      }
    }

    player.hp = Math.max(0, player.hp - amount);
  }

  /**
   * Ставит случайное заклинание указанной школы на кулдаун у playerId (см. Vine Whip,
   * Entangle, Nature's Fury). Не уменьшает уже больший существующий кулдаун — только продлевает.
   */
  private disableRandomSchoolSpell(
    match: MatchState,
    playerId: string,
    school: SpellSchool,
    durationMs: number,
    now: number,
  ): void {
    const candidates = this.spellsService.getBySchool(school);
    if (!candidates.length) return;

    const player = match.players[playerId];
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const readyAt = now + durationMs;
    player.cooldowns[pick.id] = Math.max(player.cooldowns[pick.id] ?? 0, readyAt);
  }

  startCast(
    matchId: string,
    playerId: string,
    spellId: string,
    now = Date.now(),
  ): { ok: true; cast: ActiveCast } | { ok: false; reason: string } {
    const match = this.matches.get(matchId);
    if (!match || match.finishedAt)
      return { ok: false, reason: 'match_not_active' };
    if (now < match.startsAt)
      return { ok: false, reason: 'match_not_started' };

    const player = match.players[playerId];
    if (!player) return { ok: false, reason: 'unknown_player' };
    if (player.activeCast) return { ok: false, reason: 'cast_in_progress' };

    const spell = this.spellsService.getById(spellId);
    if (!spell) return { ok: false, reason: 'unknown_spell' };
    if (player.silencedSpellId === spellId)
      return { ok: false, reason: 'silenced' };

    const readyAt = player.cooldowns[spellId] ?? 0;
    if (now < readyAt) return { ok: false, reason: 'on_cooldown' };

    const effectiveWindow = this.effectsService.getEffectiveCastWindow(
      spell.castWindowMs,
      this.effectsOn(match, playerId),
    );

    const cast: ActiveCast = {
      castId: randomUUID(),
      spellId,
      trigger: spell.trigger,
      startedAt: now,
      deadline: now + effectiveWindow,
      typedCount: 0,
    };
    player.activeCast = cast;
    return { ok: true, cast };
  }

  handleKeyInput(
    matchId: string,
    playerId: string,
    char: string,
    now = Date.now(),
  ): KeyInputResult {
    const match = this.matches.get(matchId);
    const player = match?.players[playerId];
    const cast = player?.activeCast;
    if (!match || !player || !cast) {
      return { correct: false, progress: 0, resolved: null };
    }

    if (now > cast.deadline) {
      player.activeCast = null;
      return {
        correct: false,
        progress: 0,
        resolved: this.buildResolution(
          match,
          playerId,
          cast,
          now,
          false,
          'timeout',
        ),
      };
    }

    const expectedChar = cast.trigger[cast.typedCount];
    if (char !== expectedChar) {
      // Решение зафиксировано (game-design.md, раздел 7.3): опечатка полностью сбрасывает
      // прогресс каста. Осознанный риск для длинных ultimate-триггеров — см. заметку там же.
      cast.typedCount = 0;
      return { correct: false, progress: 0, resolved: null };
    }

    cast.typedCount += 1;
    const progress = cast.typedCount / cast.trigger.length;

    if (cast.typedCount < cast.trigger.length) {
      return { correct: true, progress, resolved: null };
    }

    player.activeCast = null;
    return {
      correct: true,
      progress: 1,
      resolved: this.buildResolution(
        match,
        playerId,
        cast,
        now,
        true,
        'completed',
      ),
    };
  }

  private buildResolution(
    match: MatchState,
    casterId: string,
    cast: ActiveCast,
    now: number,
    success: boolean,
    reason: 'timeout' | 'completed',
  ): CastResolution {
    const targetId = this.opponentId(match, casterId);
    const spell = this.spellsService.getById(cast.spellId);
    const caster = match.players[casterId];

    let damage = 0;
    if (success && spell && spell.type === SpellType.Attack && spell.damage) {
      const baseDamage = rollDamage(spell.damage);
      // 'damage_boost' считает и баффы атакующего (damageDirection: 'outgoing', усиливают
      // исходящий урон), и защиту/дебафф цели вроде Ember Ward или Unstable Surge
      // (damageDirection: 'incoming', на самой цели, target: 'self') — снижает или усиливает
      // входящий урон. Обе стороны комбинируются мультипликативно в одном вызове
      // getEffectiveDamage. ignoresDamageReduction (Arcane Missile) исключает 'incoming'-эффекты
      // ЦЕЛИ из расчёта — баффы самого атакующего игнорировать смысла нет, они не "защита".
      const damageEffects = spell.ignoresDamageReduction
        ? this.effectsForDamageRole(match, casterId, 'outgoing')
        : [
            ...this.effectsForDamageRole(match, casterId, 'outgoing'),
            ...this.effectsForDamageRole(match, targetId, 'incoming'),
          ];
      damage = Math.round(
        this.effectsService.getEffectiveDamage(baseDamage, damageEffects),
      );

      const shields = this.effectsOn(match, targetId).filter(
        (e) => e.effectType === 'shield',
      );
      if (shields.length) {
        const { remainingDamage, reflected } =
          this.effectsService.absorbWithShields(damage, shields);
        damage = remainingDamage;
        match.effects = match.effects.filter(
          (e) => e.effectType !== 'shield' || e.magnitude > 0,
        );
        if (reflected > 0) {
          this.applyDamage(match, casterId, reflected);
        }
      }

      this.applyDamage(match, targetId, damage);

      // 'reflect' (Mirror Shield) — в отличие от shield.reflectRatio это не разовый пул, а
      // длящийся баф: пока активен, каждый удар по цели отражает magnitude-долю УЖЕ ПОСЛЕ
      // поглощения щитом атакующему обратно, не расходуясь.
      const reflectRatio = this.effectsOn(match, targetId)
        .filter((e) => e.effectType === 'reflect')
        .reduce((sum, e) => sum + e.magnitude, 0);
      if (reflectRatio > 0) {
        this.applyDamage(match, casterId, Math.round(damage * reflectRatio));
      }
    }

    // onHitEffect не завязан на тип заклинания: у Attack-заклинания (Blaze) он идёт вместе
    // с уроном, а у Support/Defense-заклинания (Winter's Grasp, Frozen Armor) — единственный
    // эффект каста. target: 'self' вешает эффект на самого кастера (щиты/баффы), по умолчанию —
    // на соперника (дебаффы вроде slow/dot/cooldown_reduction). randomEffectPool (Unstable
    // Surge, Entropy Veil) — то же самое, но заранее выбирается ровно один случайный элемент
    // из пула вместо фиксированного onHitEffect.
    const chosenEffect =
      spell?.onHitEffect ??
      (spell?.randomEffectPool?.length
        ? spell.randomEffectPool[
            Math.floor(Math.random() * spell.randomEffectPool.length)
          ]
        : undefined);

    if (success && chosenEffect) {
      const effectTargetId = chosenEffect.target === 'self' ? casterId : targetId;
      // durationRange (Corruption) бросается один раз здесь, а не хранится диапазоном в
      // ActiveEffect — на исходе действует уже конкретное значение.
      const durationMs = chosenEffect.durationRange
        ? Math.round(
            rollDamage({
              min: chosenEffect.durationRange[0],
              max: chosenEffect.durationRange[1],
            }),
          )
        : (chosenEffect.durationMs ?? 0);
      match.effects.push({
        id: randomUUID(),
        effectType: chosenEffect.type,
        sourceSpellId: spell!.id,
        targetPlayerId: effectTargetId,
        magnitude: chosenEffect.magnitude,
        durationMs,
        appliedAt: now,
        tickIntervalMs: chosenEffect.tickIntervalMs,
        reflectRatio: chosenEffect.reflectRatio,
        damageDirection: chosenEffect.damageDirection,
      });
    }

    if (success && spell?.healOnCast) {
      caster.hp = Math.min(MAX_HP, caster.hp + spell.healOnCast);
    }

    if (success && spell?.disableRandomSpell) {
      this.disableRandomSchoolSpell(
        match,
        targetId,
        match.players[targetId].school,
        spell.disableRandomSpell.durationMs,
        now,
      );
    }

    if (success && spell?.resetsCooldownTiers?.length) {
      // Обнуляем ДО стандартного блока кулдауна ниже: если сбрасываемый тир совпадает с тиром
      // самого кастуемого заклинания (как у Time Warp — Ultimate), стандартный блок всё равно
      // следом поставит на кулдаун сам каст — сброс "своего" тира тут заведомо перекрывается,
      // и это ожидаемо: нельзя обнулить кулдаун заклинанию, использованному прямо сейчас.
      for (const tier of spell.resetsCooldownTiers) {
        for (const s of this.spellsService.getBySchoolAndTier(spell.school, tier)) {
          delete caster.cooldowns[s.id];
        }
      }
    }

    if (success && spell) {
      const effectiveCooldown = this.effectsService.getEffectiveCooldown(
        spell.cooldownMs,
        this.effectsOn(match, casterId),
      );

      // cooldown_delay (Void Collapse) — флэт-добавка к кулдауну СЛЕДУЮЩЕГО успешного каста,
      // расходуется здесь за одно применение (в отличие от процентных cooldown_reduction,
      // которые просто действуют, пока не истёк их durationMs).
      const delays = this.effectsOn(match, casterId).filter(
        (e) => e.effectType === 'cooldown_delay',
      );
      const flatDelay = delays.reduce((sum, e) => sum + e.magnitude, 0);
      if (delays.length) {
        const consumedIds = new Set(delays.map((e) => e.id));
        match.effects = match.effects.filter((e) => !consumedIds.has(e.id));
      }

      const readyAt = now + effectiveCooldown + flatDelay;
      // Кулдаун общий на весь тир внутри школы (раздел 7 game-design.md): игрок может
      // использовать только заклинания школы своего мага, поэтому "весь тир целиком" на
      // практике и есть "все доступные игроку заклинания этого тира".
      for (const tierMate of this.spellsService.getTierMates(spell)) {
        caster.cooldowns[tierMate.id] = readyAt;
      }
      // TODO: хил (Regrowth heal-тики) пока не заведён — нужна отдельная логика (тики
      // восстановления HP), которую generic onHitEffect выше не покрывает.
    }

    this.checkWinCondition(match, now);

    return {
      success,
      spellId: cast.spellId,
      casterId,
      targetId,
      damage,
      timeTakenMs: now - cast.startedAt,
      reason,
    };
  }

  private checkWinCondition(match: MatchState, now: number): void {
    if (match.finishedAt) return;
    for (const playerId of match.playerIds) {
      if (match.players[playerId].hp <= 0) {
        match.finishedAt = now;
        match.winnerId = this.opponentId(match, playerId);
        return;
      }
    }
  }

  /** Общий тикер боя (раздел 6.4): DoT/HoT, истечение эффектов, таймауты активных кастов. */
  tick(matchId: string, now = Date.now()): void {
    const match = this.matches.get(matchId);
    if (!match || match.finishedAt) return;

    const dueTicks = this.effectsService.collectDueTicks(match.effects, now);
    for (const effect of dueTicks) {
      const target = match.players[effect.targetPlayerId];
      if (!target) continue;
      if (effect.effectType === 'dot') {
        this.applyDamage(match, effect.targetPlayerId, effect.magnitude);
      } else if (effect.effectType === 'hot') {
        target.hp = Math.min(MAX_HP, target.hp + effect.magnitude);
      }
    }

    match.effects = this.effectsService.pruneExpired(match.effects, now);

    for (const playerId of match.playerIds) {
      const cast = match.players[playerId].activeCast;
      if (cast && now > cast.deadline) {
        match.players[playerId].activeCast = null;
      }
    }

    this.checkWinCondition(match, now);
  }
}
