import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EffectsService } from '../effects/effects.service';
import { SpellsService } from '../spells/spells.service';
import { SpellTier, SpellType } from '../spells/spell.types';
import {
  ActiveCast,
  CastResolution,
  KeyInputResult,
  MatchState,
  PlayerState,
} from './duel.types';

const MAX_HP = 100;

// Пауза между match_found и стартом боя (см. раздел 7.5 game-design.md): даёт клиентам
// время отрисовать сцену/арену до того, как разрешены первые касты.
const PRE_MATCH_DELAY_MS = 3000;

// Плейсхолдер баланса урона по уровню сложности — требует калибровки (раздел 5.2).
const BASE_DAMAGE_BY_TIER: Record<SpellTier, number> = {
  [SpellTier.Basic]: 8,
  [SpellTier.Advanced]: 14,
  [SpellTier.Ultimate]: 22,
};

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
    playerBId: string,
    now = Date.now(),
  ): MatchState {
    const match: MatchState = {
      matchId: randomUUID(),
      playerIds: [playerAId, playerBId],
      players: {
        [playerAId]: this.createPlayerState(playerAId),
        [playerBId]: this.createPlayerState(playerBId),
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

  private createPlayerState(playerId: string): PlayerState {
    return {
      playerId,
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
    if (success && spell && spell.type === SpellType.Attack) {
      const baseDamage = BASE_DAMAGE_BY_TIER[spell.tier];
      damage = Math.round(
        this.effectsService.getEffectiveDamage(
          baseDamage,
          this.effectsOn(match, casterId),
        ),
      );
      const target = match.players[targetId];
      target.hp = Math.max(0, target.hp - damage);
    }

    if (success && spell) {
      const effectiveCooldown = this.effectsService.getEffectiveCooldown(
        spell.cooldownMs,
        this.effectsOn(match, casterId),
      );
      caster.cooldowns[spell.id] = now + effectiveCooldown;
      // TODO: применение специфичных баффов/дебаффов заклинания (щиты, замедления, DoT и т.д.)
      // не входит в этот скаффолд — привязка эффектов к конкретным заклинаниям ещё не
      // формализована в game-design.md и требует отдельного прохода данных.
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
        target.hp = Math.max(0, target.hp - effect.magnitude);
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
