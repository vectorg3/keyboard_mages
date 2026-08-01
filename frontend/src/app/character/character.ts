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
    const { width, height } = this.app.screen;
    this.root.position.set(width / 2, height / 2);
    if (this.bodySprite) this.fitSprite(this.bodySprite);
    if (this.vfxSprite) this.fitSprite(this.vfxSprite);
  }

  private fitSprite(sprite: AnimatedSprite): void {
    if (!this.app) return;
    const size = Math.min(this.app.screen.width, this.app.screen.height);
    sprite.width = size;
    sprite.height = size;
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
    this.fitSprite(sprite);
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
    this.fitSprite(sprite);
    this.root.addChild(sprite);
    this.vfxSprite = sprite;
  }
}
