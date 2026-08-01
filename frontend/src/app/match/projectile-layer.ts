import { AnimatedSprite, Application, Assets, Texture } from 'pixi.js';
import { SpriteGrid } from '../character/sprite-sheet-data';
import { createAnimatedSprite } from '../character/sprite-animator';

/** How long a projectile takes to cross the arena, regardless of distance — the sheet's own
 *  durationMs paces the spin loop, not the flight. */
const FLIGHT_MS = 350;
/** Displayed projectile size in CSS px — independent of the sheet's native frame size (48×48),
 *  matched by eye against the character canvas scale. */
const PROJECTILE_SIZE_PX = 76;

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
}
