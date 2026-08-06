import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AnimatedSprite, Application, Assets, Container, Texture } from 'pixi.js';
import { EffectInfo } from '../socket.service';
import { FloatingNumber } from './floating-number';
import { MageType } from '../shared/mage-type';
import { Fighter } from './fighter';
import { formatCooldown, spellIconPath } from '../shared/format';
import { SPELL_BY_ID } from '../shared/spells-data';
import { CHARACTER_SPRITES, SpriteGrid, spellVfxGrid } from './sprite-sheet-data';
import { createAnimatedSprite } from './sprite-animator';

type BodyAnimationKind = 'idle' | 'attack' | 'death';

/**
 * Один боец на арене: имя, иконки баффов/дебаффов, HP-бар, летающие циферки урона/хила и
 * спрайт (idle/attack/death), отрисованный на PixiJS canvas. Чисто презентационный компонент —
 * всё состояние боя (HP, эффекты, кулдауны) остаётся в Match, сюда приходит только на
 * отображение через input().
 */
@Component({
  selector: 'app-character',
  imports: [],
  templateUrl: './character.html',
  styleUrl: './character.css',
  host: {
    class: 'character',
    '[class.character--foe]': "side() === 'foe'",
  },
})
export class Character implements AfterViewInit, OnDestroy {
  readonly side = input.required<Fighter>();
  readonly name = input.required<string>();
  readonly mageType = input.required<MageType>();
  readonly hpPercent = input.required<number>();
  readonly effects = input.required<EffectInfo[]>();
  readonly floatingNumbers = input.required<FloatingNumber[]>();
  readonly attacking = input.required<boolean>();
  /** Monotonically increasing token from Match; each new value restarts the white impact flash. */
  readonly hitFlash = input(0);

  /** spellId проигрываемого сейчас VFX-каста (см. SPELL_VFX) на ЭТОМ персонаже, как цели
   *  заклинания — null, если сейчас ничего не играется. */
  readonly vfxSpellId = input<string | null>(null);

  /** true — проигрывает анимацию смерти один раз и остаётся на последнем кадре
   *  (AnimatedSprite.loop = false останавливается на последнем кадре сам), никогда не
   *  сбрасывается обратно в false — персонаж умирает максимум раз за матч. */
  readonly dying = input<boolean>(false);

  readonly attackAnimationEnd = output<void>();
  readonly vfxAnimationEnd = output<void>();
  readonly deathAnimationEnd = output<void>();

  protected readonly formatCooldown = formatCooldown;
  protected readonly spellIconPath = spellIconPath;

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('spriteCanvas');
  /** Флип на true как только PIXI.Application готов к отрисовке — реактивные effect()-ы ниже
   *  читают этот сигнал, чтобы не пытаться рисовать до готовности canvas. */
  private readonly pixiReady = signal(false);

  private app: Application | null = null;
  private root: Container | null = null;
  private bodySprite: AnimatedSprite | null = null;
  private vfxSprite: AnimatedSprite | null = null;
  /** Счётчики поколений — playBodyAnimation/playVfx грузят текстуру асинхронно; если за время
   *  загрузки пришёл более новый вызов (например attacking переключился false→true за один
   *  кадр), устаревший результат должен быть отброшен, а не перезаписать более новый спрайт. */
  private bodyGeneration = 0;
  private vfxGeneration = 0;

  constructor() {
    effect(() => {
      if (!this.pixiReady()) return;
      const dying = this.dying();
      const attacking = this.attacking();
      const sprites = CHARACTER_SPRITES[this.mageType()];
      const kind: BodyAnimationKind = dying ? 'death' : attacking ? 'attack' : 'idle';
      void this.playBodyAnimation(kind, sprites[kind]);
    });

    effect(() => {
      if (!this.pixiReady()) return;
      void this.playVfx(this.vfxSpellId());
    });

    effect(() => {
      if (!this.pixiReady() || this.hitFlash() === 0) return;
      const canvas = this.canvasRef().nativeElement;
      // Removing the class and forcing layout makes consecutive rapid hits restart the CSS steps.
      canvas.classList.remove('sprite-canvas--damage-flash');
      void canvas.offsetWidth;
      canvas.classList.add('sprite-canvas--damage-flash');
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.canvasRef().nativeElement;
    const app = new Application();
    await app.init({
      canvas,
      resizeTo: canvas,
      backgroundAlpha: 0,
      antialias: false,
      // No autoDensity: it makes Pixi write inline canvas.style.width/height matching the
      // backing buffer, which fights the CSS clamp() in .sprite-canvas (character.css) that's
      // meant to own the element's display size. Without it, the canvas behaves like any plain
      // <canvas> — CSS controls display size, the browser scales the higher-res backing buffer
      // down to fit, which is exactly the crisp-on-retina effect resolution is for here.
      resolution: window.devicePixelRatio || 1,
    });
    // Component could be destroyed while init() was in flight (fast navigation away from match).
    if (!canvas.isConnected) {
      app.destroy(true, { children: true, texture: true });
      return;
    }
    this.app = app;

    const root = new Container();
    root.scale.x = this.side() === 'foe' ? -1 : 1;
    app.stage.addChild(root);
    this.root = root;

    // Pixi's ResizePlugin only reacts to window "resize" events (see resizeTo), which is a poor
    // fit for a box sized by CSS clamp()/vw — driving layout() off the ticker instead keeps the
    // sprite's fit in sync with app.screen every frame regardless of what triggered the change.
    app.ticker.add(() => this.layout());
    this.pixiReady.set(true);
  }

  ngOnDestroy(): void {
    this.app?.destroy(true, { children: true, texture: true });
    this.app = null;
    this.root = null;
    this.bodySprite = null;
    this.vfxSprite = null;
  }

  /** Название заклинания-источника эффекта — для title-подсказки на иконке. */
  protected effectSpellName(sourceSpellId: string): string {
    return SPELL_BY_ID[sourceSpellId]?.name ?? sourceSpellId;
  }

  private layout(): void {
    if (!this.app || !this.root) return;
    const canvas = this.canvasRef().nativeElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    if (this.app.screen.width !== canvasWidth || this.app.screen.height !== canvasHeight) {
      this.app.renderer.resize(canvasWidth, canvasHeight);
    }
    const { width, height } = this.app.screen;
    this.root.position.set(width / 2, height / 2);
    if (this.bodySprite) this.fitBodySprite(this.bodySprite);
    if (this.vfxSprite) this.fitVfxSprite(this.vfxSprite);
  }

  private fitBodySprite(sprite: AnimatedSprite): void {
    if (!this.app) return;
    const wrap = this.canvasRef().nativeElement.parentElement;
    const size = wrap
      ? Math.min(wrap.clientWidth, wrap.clientHeight)
      : Math.min(this.app.screen.width, this.app.screen.height);
    sprite.width = size;
    sprite.height = size;
    // Storm canvases grow upward while their bottom edge stays anchored to the fighter.
    // Keep the body in the original bottom-aligned square instead of at the enlarged canvas center.
    sprite.position.set(
      0,
      this.isStormVfx() ? (this.app.screen.height - size) / 2 : 0,
    );
  }

  private fitVfxSprite(sprite: AnimatedSprite): void {
    if (!this.app) return;
    if (this.isStormVfx()) {
      sprite.width = this.app.screen.width;
      sprite.height = this.app.screen.height;
      // The target character's root is mirrored on the right side. Blizzard is directional,
      // so flip it locally once more: its shards must always travel caster -> target.
      sprite.scale.x =
        (this.vfxSpellId() === 'ice_blizzard' ? -1 : 1) * Math.abs(sprite.scale.x);
      // Storm sheets keep their impact line around y=52 in a 64px frame. Move it closer to the
      // canvas bottom so falling projectiles land at the fighter's feet instead of their torso.
      sprite.position.set(0, this.app.screen.height * (10 / 64));
      return;
    }
    const size = Math.min(this.app.screen.width, this.app.screen.height);
    sprite.width = size;
    sprite.height = size;
    sprite.position.set(0, 0);
  }

  private isStormVfx(): boolean {
    const spellId = this.vfxSpellId();
    return spellId === 'fire_inferno_storm' || spellId === 'ice_blizzard';
  }

  private async loadTexture(path: string): Promise<Texture> {
    const texture = await Assets.load<Texture>(path);
    texture.source.scaleMode = 'nearest';
    return texture;
  }

  private async playBodyAnimation(kind: BodyAnimationKind, grid: SpriteGrid): Promise<void> {
    const generation = ++this.bodyGeneration;
    const texture = await this.loadTexture(grid.path);
    if (!this.root || generation !== this.bodyGeneration) return;

    this.bodySprite?.destroy();
    const sprite = createAnimatedSprite(texture, grid, {
      loop: kind === 'idle',
      onComplete:
        kind === 'death'
          ? () => this.deathAnimationEnd.emit()
          : kind === 'attack'
            ? () => this.attackAnimationEnd.emit()
            : undefined,
    });
    this.fitBodySprite(sprite);
    this.root.addChildAt(sprite, 0);
    this.bodySprite = sprite;
  }

  private async playVfx(spellId: string | null): Promise<void> {
    const generation = ++this.vfxGeneration;
    const grid = spellId ? spellVfxGrid(spellId) : undefined;
    if (!grid) {
      this.vfxSprite?.destroy();
      this.vfxSprite = null;
      return;
    }

    const texture = await this.loadTexture(grid.path);
    if (!this.root || generation !== this.vfxGeneration) return;

    this.vfxSprite?.destroy();
    const sprite = createAnimatedSprite(texture, grid, {
      loop: false,
      onComplete: () => this.vfxAnimationEnd.emit(),
    });
    this.fitVfxSprite(sprite);
    this.root.addChild(sprite);
    this.vfxSprite = sprite;
  }
}
