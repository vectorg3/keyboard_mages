import { AnimatedSprite, Application, Assets, Sprite, Texture } from 'pixi.js';
import { SpriteGrid } from '../character/sprite-sheet-data';
import { createAnimatedSprite } from '../character/sprite-animator';

/** How long a projectile takes to cross the arena, regardless of distance — the sheet's own
 *  durationMs paces the spin loop, not the flight. */
const FLIGHT_MS = 350;
/** Displayed projectile size in CSS px — independent of the sheet's native frame size (48×48),
 *  matched by eye against the character canvas scale. */
const PROJECTILE_SIZE_PX = 76;
const DIRECTED_PROJECTILE_TRAVEL_MS = 420;
const DIRECTED_PROJECTILE_WIDTH_PX = 136;
const DIRECTED_PROJECTILE_HEIGHT_PX = 102;
const ICE_GRASP_TRAVEL_MS = 700;
const ICE_GRASP_WIDTH_PX = 184;
const ICE_GRASP_HEIGHT_PX = 122;
const ARCANE_MISSILE_TRAVEL_MS = 360;
const ARCANE_MISSILE_WIDTH_PX = 104;
const ARCANE_MISSILE_HEIGHT_PX = 78;
const TIME_WARP_SIZE_PX = 180;
const TIME_WARP_FRONT_OFFSET_PX = 92;

export interface Point {
  x: number;
  y: number;
}

/** Renders attack projectiles (see CHARACTER_SPRITES[...].projectile) flying between the two
 *  fighters, on its own canvas spanning the whole arena — a projectile crosses the gap between
 *  the two per-character canvases in Character, so it can't live inside either of them. */
export class ProjectileLayer {
  private app: Application | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const app = new Application();
    await app.init({
      canvas,
      resizeTo: canvas,
      backgroundAlpha: 0,
      antialias: false,
      // See Character.ngAfterViewInit for why autoDensity is deliberately omitted.
      resolution: window.devicePixelRatio || 1,
    });
    if (!canvas.isConnected) {
      app.destroy(true, { children: true, texture: true });
      return;
    }
    this.app = app;
  }

  destroy(): void {
    this.app?.destroy(true, { children: true, texture: true });
    this.app = null;
  }

  /** Spawns a continuously-spinning projectile that flies from `from` to `to` (canvas-local CSS
   *  px, e.g. from getBoundingClientRect() minus the canvas's own origin) and destroys itself on
   *  arrival. Fire-and-forget — errors (e.g. component destroyed mid-load) are swallowed since
   *  there's no caller waiting on completion. */
  fire(grid: SpriteGrid, from: Point, to: Point): void {
    void this.flight(grid, from, to);
  }

  /** Launches a non-spinning projectile whose artwork must face its direction of travel. */
  fireDirected(grid: SpriteGrid, from: Point, to: Point): void {
    void this.directedFlight(grid, from, to);
  }

  /** Sends an arena-wide effect directly from the caster to the target. */
  sweepThrough(grid: SpriteGrid, from: Point, to: Point): void {
    void this.wintersGrasp(grid, from, to);
  }

  /** Fires three staggered arcane bolts along slightly different paths. */
  fireArcaneVolley(grid: SpriteGrid, from: Point, to: Point): void {
    void this.arcaneVolley(grid, from, to);
  }

  /** Shows a rotating hourglass in the open space between the caster and their opponent. */
  showTimeWarp(grid: SpriteGrid, caster: Point, opponent: Point): void {
    void this.timeWarp(grid, caster, opponent);
  }

  private async flight(grid: SpriteGrid, from: Point, to: Point): Promise<void> {
    const app = this.app;
    if (!app) return;
    const texture = await Assets.load<Texture>(grid.path);
    texture.source.scaleMode = 'nearest';
    if (!this.app || this.app !== app) return; // destroyed/replaced while the texture loaded

    const sprite = createAnimatedSprite(texture, grid, { loop: true });
    sprite.anchor.set(0.5);
    sprite.width = PROJECTILE_SIZE_PX;
    sprite.height = PROJECTILE_SIZE_PX;
    sprite.position.set(from.x, from.y);
    app.stage.addChild(sprite);

    const startTime = performance.now();
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - startTime) / FLIGHT_MS);
      sprite.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (t >= 1) {
        app.ticker.remove(tick);
        sprite.destroy();
      }
    };
    app.ticker.add(tick);
  }

  private async directedFlight(grid: SpriteGrid, from: Point, to: Point): Promise<void> {
    const app = this.app;
    if (!app) return;
    const texture = await Assets.load<Texture>(grid.path);
    texture.source.scaleMode = 'nearest';
    if (!this.app || this.app !== app) return;

    const direction = Math.sign(to.x - from.x) || 1;
    const sprite = createAnimatedSprite(texture, grid, { loop: true });
    sprite.anchor.set(0.5);
    sprite.width = DIRECTED_PROJECTILE_WIDTH_PX;
    sprite.height = DIRECTED_PROJECTILE_HEIGHT_PX;
    if (direction < 0) sprite.scale.x *= -1;
    sprite.position.set(from.x, from.y);
    app.stage.addChild(sprite);

    const startTime = performance.now();
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - startTime) / DIRECTED_PROJECTILE_TRAVEL_MS);
      sprite.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (t >= 1) {
        app.ticker.remove(tick);
        sprite.destroy();
      }
    };
    app.ticker.add(tick);
  }

  private async wintersGrasp(grid: SpriteGrid, from: Point, to: Point): Promise<void> {
    const app = this.app;
    if (!app) return;
    const texture = await Assets.load<Texture>(grid.path);
    texture.source.scaleMode = 'nearest';
    if (!this.app || this.app !== app) return;

    const direction = Math.sign(to.x - from.x) || 1;
    const startX = from.x;
    const endX = to.x;
    const sprite = createAnimatedSprite(texture, grid, { loop: true });
    sprite.anchor.set(0.5);
    sprite.width = ICE_GRASP_WIDTH_PX;
    sprite.height = ICE_GRASP_HEIGHT_PX;
    if (direction < 0) sprite.scale.x *= -1;
    sprite.position.set(startX, from.y);
    app.stage.addChild(sprite);

    const startTime = performance.now();
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - startTime) / ICE_GRASP_TRAVEL_MS);
      const eased = 1 - (1 - t) * (1 - t);
      sprite.position.set(
        startX + (endX - startX) * eased,
        from.y + (to.y - from.y) * eased,
      );
      if (t > 0.82) sprite.alpha = (1 - t) / 0.18;
      if (t >= 1) {
        app.ticker.remove(tick);
        sprite.destroy();
      }
    };
    app.ticker.add(tick);
  }

  private async arcaneVolley(grid: SpriteGrid, from: Point, to: Point): Promise<void> {
    const app = this.app;
    if (!app) return;
    const texture = await Assets.load<Texture>(grid.path);
    texture.source.scaleMode = 'nearest';
    if (!this.app || this.app !== app) return;

    const direction = Math.sign(to.x - from.x) || 1;
    const bolts = [
      { delay: 0, arc: -17, tint: 0xcba7ff },
      { delay: 110, arc: 12, tint: 0x89eaff },
      { delay: 220, arc: -5, tint: 0xe1b5ff },
    ];

    for (const bolt of bolts) {
      const sprite = createAnimatedSprite(texture, grid, { loop: true });
      sprite.anchor.set(0.5);
      sprite.width = ARCANE_MISSILE_WIDTH_PX;
      sprite.height = ARCANE_MISSILE_HEIGHT_PX;
      if (direction < 0) sprite.scale.x *= -1;
      sprite.position.set(from.x, from.y);
      app.stage.addChild(sprite);

      const startTime = performance.now() + bolt.delay;
      let lastTrailAt = 0;
      const tick = (): void => {
        const elapsed = performance.now() - startTime;
        if (elapsed < 0) return;
        const t = Math.min(1, elapsed / ARCANE_MISSILE_TRAVEL_MS);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t + bolt.arc * Math.sin(Math.PI * t);
        sprite.position.set(x, y);
        if (elapsed - lastTrailAt >= 45 && t < 0.95) {
          lastTrailAt = elapsed;
          this.arcaneTrail(app, x - direction * 19, y, bolt.tint);
        }
        if (t >= 1) {
          app.ticker.remove(tick);
          sprite.destroy();
        }
      };
      app.ticker.add(tick);
    }
  }

  private arcaneTrail(app: Application, x: number, y: number, tint: number): void {
    const particle = new Sprite(Texture.WHITE);
    particle.anchor.set(0.5);
    particle.tint = tint;
    particle.width = 7;
    particle.height = 4;
    particle.alpha = 0.78;
    particle.position.set(x, y);
    app.stage.addChild(particle);

    const tick = (): void => {
      particle.alpha -= 0.12;
      particle.width = Math.max(1, particle.width - 0.7);
      particle.height = Math.max(1, particle.height - 0.35);
      if (particle.alpha <= 0) {
        app.ticker.remove(tick);
        particle.destroy();
      }
    };
    app.ticker.add(tick);
  }

  private async timeWarp(grid: SpriteGrid, caster: Point, opponent: Point): Promise<void> {
    const app = this.app;
    if (!app) return;
    const texture = await Assets.load<Texture>(grid.path);
    texture.source.scaleMode = 'nearest';
    if (!this.app || this.app !== app) return;

    const direction = Math.sign(opponent.x - caster.x) || 1;
    const sprite = createAnimatedSprite(texture, grid, { loop: false });
    sprite.anchor.set(0.5);
    sprite.width = TIME_WARP_SIZE_PX;
    sprite.height = TIME_WARP_SIZE_PX;
    sprite.position.set(caster.x + direction * TIME_WARP_FRONT_OFFSET_PX, caster.y - 8);
    app.stage.addChild(sprite);

    const startTime = performance.now();
    const tick = (): void => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / grid.durationMs);
      // Pixi's positive rotation direction follows screen coordinates, i.e. clockwise.
      sprite.rotation = Math.PI * 2 * t;
      if (t >= 1) {
        app.ticker.remove(tick);
        sprite.destroy();
      }
    };
    app.ticker.add(tick);
  }

}
