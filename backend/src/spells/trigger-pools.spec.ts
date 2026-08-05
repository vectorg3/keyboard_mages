import { SpellSchool, SpellTier } from './spell.types';
import { pickTrigger, TRIGGER_POOLS } from './trigger-pools';

describe('trigger pools', () => {
  it('defines non-empty lowercase ASCII pools for every school and tier', () => {
    for (const school of Object.values(SpellSchool)) {
      for (const tier of Object.values(SpellTier).filter(
        (value): value is SpellTier => typeof value === 'number',
      )) {
        const pool = TRIGGER_POOLS[school][tier];
        expect(pool.length).toBeGreaterThan(1);
        expect(pool.every((word) => /^[a-z]+$/.test(word))).toBe(true);
      }
    }
  });

  it('does not select the previous trigger when alternatives exist', () => {
    const previous = TRIGGER_POOLS[SpellSchool.Fire][SpellTier.Basic][0];
    const selected = pickTrigger(
      SpellSchool.Fire,
      SpellTier.Basic,
      previous,
      () => 0,
    );
    expect(selected).not.toBe(previous);
  });

  it('uses the requested school and tier pool', () => {
    const selected = pickTrigger(
      SpellSchool.Ice,
      SpellTier.Ultimate,
      null,
      () => 0,
    );
    expect(TRIGGER_POOLS[SpellSchool.Ice][SpellTier.Ultimate]).toContain(
      selected,
    );
  });
});
