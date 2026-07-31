import { Injectable } from '@nestjs/common';
import { SPELL_ROSTER } from './spell-roster';
import { Spell, SpellSchool, SpellTier, SpellType } from './spell.types';

@Injectable()
export class SpellsService {
  private readonly byId = new Map<string, Spell>();
  private readonly byTrigger = new Map<string, Spell>();

  constructor() {
    for (const s of SPELL_ROSTER) {
      this.byId.set(s.id, s);
      this.byTrigger.set(s.trigger, s);
    }
  }

  getAll(): Spell[] {
    return SPELL_ROSTER;
  }

  getById(id: string): Spell | undefined {
    return this.byId.get(id);
  }

  getByTrigger(trigger: string): Spell | undefined {
    return this.byTrigger.get(trigger);
  }

  /** Заклинания той же школы и тира, что и данное (включая само заклинание) —
   *  делят один общий кулдаун (см. раздел 7 game-design.md). */
  getTierMates(spell: Spell): Spell[] {
    return SPELL_ROSTER.filter(
      (s) => s.school === spell.school && s.tier === spell.tier,
    );
  }

  getBySchoolAndTier(school: SpellSchool, tier: SpellTier): Spell[] {
    return SPELL_ROSTER.filter((s) => s.school === school && s.tier === tier);
  }

  getBySchool(school: SpellSchool): Spell[] {
    return SPELL_ROSTER.filter((s) => s.school === school);
  }

  /** Единственное заклинание бота (см. BotService/DuelService.driveBot) — первое Attack базового
   *  тира школы, наносящее урон. Не хардкодит id: подхватит правильный спелл сам, если ростер
   *  когда-нибудь переупорядочат. */
  getBotSpell(school: SpellSchool): Spell | undefined {
    return SPELL_ROSTER.find(
      (s) => s.school === school && s.tier === SpellTier.Basic && s.type === SpellType.Attack,
    );
  }
}
