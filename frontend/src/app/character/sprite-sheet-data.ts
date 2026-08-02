import { MageType } from '../shared/mage-type';
import { SPELL_VFX } from '../shared/spell-vfx-data';

/** Geometry + timing for one sprite-sheet animation — the canvas-era equivalent of the old
 *  CSS background-size/steps()/animation-duration trio. Frames are read left-to-right, then
 *  top-to-bottom, matching the background-position order the CSS keyframes used to step through. */
export interface SpriteGrid {
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frameCount: number;
  durationMs: number;
}

interface SchoolSprites {
  idle: SpriteGrid;
  attack: SpriteGrid;
  death: SpriteGrid;
  /** Projectile flying from caster to target on attack — optional, only fire has one so far.
   *  Lives outside the per-character canvas (see ProjectileLayer in match/), so only geometry/
   *  timing is needed here, not a `path` consumer inside Character. */
  projectile?: SpriteGrid;
}

const IDLE_DURATION_MS = 1600;

/** Idle/attack/death sprite sheets per school, in public/mage-sprites/{school}/ — durations taken
 *  1:1 from the CSS they replace (character-sprite.css + character.css). Grid geometry (columns/
 *  rows) also matches the old CSS background-size, but frameWidth/frameHeight do NOT match the
 *  size baked into each filename (e.g. "64x64px") — the old CSS used percentage-based
 *  background-size, which is resolution-independent, so nobody had to know the real pixel size.
 *  The actual sheets measure 4× the filename's number (256×256) — verified by loading each PNG
 *  and reading naturalWidth/Height, not by trusting the filename. Fire's death sheet originally
 *  exported on an oversized 340×340 canvas (filename "85x85") with the same-scale character art
 *  as its other animations, just surrounded by extra padding — that made it render visibly
 *  smaller than every other death animation once scaled to fit the character box. The PNG has
 *  been re-cropped to a centered 256×256 per frame to match the rest. */
export const CHARACTER_SPRITES: Record<MageType, SchoolSprites> = {
  fire: {
    idle: {
      path: '/mage-sprites/fire/sprite-64x64px-8f-sheet-idle.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: IDLE_DURATION_MS,
    },
    attack: {
      path: '/mage-sprites/fire/sprite-64x64px-8f-sheet-attack.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 640,
    },
    death: {
      path: '/mage-sprites/fire/sprite-animation-85x85-8f-sheet-death.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 800,
    },
    // Continuously looped while the projectile flies (see ProjectileLayer) — durationMs here is
    // one spin cycle, not the flight time, which ProjectileLayer controls separately.
    projectile: {
      path: '/mage-sprites/fire/Fire_projectile.png',
      frameWidth: 48,
      frameHeight: 48,
      columns: 4,
      rows: 1,
      frameCount: 4,
      durationMs: 240,
    },
  },
  ice: {
    idle: {
      path: '/mage-sprites/frost/sprite-64x64px-8f-sheet-idle.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: IDLE_DURATION_MS,
    },
    attack: {
      path: '/mage-sprites/frost/sprite-64x64px-10f-sheet-attack.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 5,
      rows: 2,
      frameCount: 10,
      durationMs: 800,
    },
    death: {
      path: '/mage-sprites/frost/sprite-animation-64x64-8f-sheet-death.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 800,
    },
  },
  chaos: {
    idle: {
      path: '/mage-sprites/chaos/sprite-64x64px-8f-sheet-idle.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: IDLE_DURATION_MS,
    },
    attack: {
      path: '/mage-sprites/chaos/sprite-64x64px-10f-sheet-attack.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 5,
      rows: 2,
      frameCount: 10,
      durationMs: 800,
    },
    death: {
      path: '/mage-sprites/chaos/sprite-animation-64x64-8f-sheet-death.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 800,
    },
  },
  arcane: {
    idle: {
      path: '/mage-sprites/arcane/sprite-64x64px-8f-sheet-idle.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: IDLE_DURATION_MS,
    },
    attack: {
      path: '/mage-sprites/arcane/sprite-64x64px-10f-sheet-attack.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 5,
      rows: 2,
      frameCount: 10,
      durationMs: 800,
    },
    death: {
      path: '/mage-sprites/arcane/sprite-animation-64x64-8f-sheet-death.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 800,
    },
  },
  nature: {
    idle: {
      path: '/mage-sprites/nature/sprite-64x64px-8f-sheet-idle.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: IDLE_DURATION_MS,
    },
    attack: {
      path: '/mage-sprites/nature/sprite-64x64px-10f-sheet-attack.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 5,
      rows: 2,
      frameCount: 10,
      durationMs: 800,
    },
    death: {
      path: '/mage-sprites/nature/sprite-64x64px-8f-sheet-death.png',
      frameWidth: 256,
      frameHeight: 256,
      columns: 4,
      rows: 2,
      frameCount: 8,
      durationMs: 800,
    },
  },
};

/** All spell VFX sheets are a single row of 64×64 frames (see SPELL_VFX comments) — this adapts
 *  a SPELL_VFX entry into the same SpriteGrid shape the character sheets use, so both go through
 *  the one sprite-animator helper. Returns undefined for spells with no VFX sprite yet. */
export function spellVfxGrid(spellId: string): SpriteGrid | undefined {
  const vfx = SPELL_VFX[spellId];
  if (!vfx) return undefined;
  return {
    path: vfx.path,
    frameWidth: 64,
    frameHeight: 64,
    columns: vfx.frameCount,
    rows: 1,
    frameCount: vfx.frameCount,
    durationMs: vfx.durationMs,
  };
}
