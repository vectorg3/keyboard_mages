import { Injectable } from '@nestjs/common';
import { SPELL_ROSTER } from './spell-roster';
import { Spell } from './spell.types';

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
}
