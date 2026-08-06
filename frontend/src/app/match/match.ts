import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { SocketService } from '../socket.service';
import { SPELL_BUTTONS_BY_SCHOOL, SPELL_BY_ID } from '../shared/spells-data';
import { MageType } from '../shared/mage-type';
import { Fighter } from '../character/fighter';
import { FloatingNumber } from '../character/floating-number';
import {
  castingSoundPath,
  formatCooldown,
  keySpritePath,
  spellIconPath,
  spellSoundPath,
} from '../shared/format';
import { Character } from '../character/character';
import { SPELL_VFX } from '../shared/spell-vfx-data';
import { CHARACTER_SPRITES, SpriteGrid } from '../character/sprite-sheet-data';
import { SpellSoundService } from '../shared/spell-sound.service';
import { CastingSoundService } from '../shared/casting-sound.service';
import { Point, ProjectileLayer } from './projectile-layer';

// Должно совпадать с длительностью CSS-анимации .floating-number (character.css), иначе циферка
// либо пропадёт из DOM до конца анимации, либо повиснет статично после её завершения.
const FLOATING_NUMBER_LIFETIME_MS = 1000;

const WINTERS_GRASP_HAND: SpriteGrid = {
  path: '/spell-animations/frost/ice_winters_grasp_hand.png',
  frameWidth: 96,
  frameHeight: 64,
  columns: 8,
  rows: 1,
  frameCount: 8,
  durationMs: 600,
};

const ICE_SHARD_PROJECTILE: SpriteGrid = {
  path: '/spell-animations/frost/ice_ice_shard_projectile.png',
  frameWidth: 64,
  frameHeight: 48,
  columns: 8,
  rows: 1,
  frameCount: 8,
  durationMs: 480,
};

const ARCANE_MISSILE_PROJECTILE: SpriteGrid = {
  path: '/spell-animations/arcane/arcane_arcane_missile_projectile.png',
  frameWidth: 64,
  frameHeight: 48,
  columns: 9,
  rows: 1,
  frameCount: 9,
  durationMs: 360,
};

const TIME_WARP_HOURGLASS: SpriteGrid = {
  path: '/spell-animations/arcane/arcane_time_warp.png',
  frameWidth: 64,
  frameHeight: 64,
  columns: 14,
  rows: 1,
  frameCount: 14,
  durationMs: 1120,
};

const CHAOS_BOLT_PROJECTILE: SpriteGrid = {
  path: '/spell-animations/chaos/chaos_chaos_bolt_projectile.png',
  frameWidth: 64,
  frameHeight: 48,
  columns: 8,
  rows: 1,
  frameCount: 8,
  durationMs: 420,
};

const CORRUPTION_HAND_PROJECTILE: SpriteGrid = {
  path: '/spell-animations/chaos/chaos_corruption_hand.png',
  frameWidth: 64,
  frameHeight: 48,
  columns: 8,
  rows: 1,
  frameCount: 8,
  durationMs: 420,
};

const VINE_WHIP_PROJECTILE: SpriteGrid = {
  path: '/spell-animations/nature/nature_vine_whip_projectile.png',
  frameWidth: 96,
  frameHeight: 64,
  columns: 8,
  rows: 1,
  frameCount: 8,
  durationMs: 640,
};

// Пауза между концом анимации смерти (см. onDeathAnimationEnd) и появлением окна победы/поражения —
// даёт кадру с погибшим персонажем "повисеть" перед тем, как его накроет оверлей результата.
const RESULT_DELAY_AFTER_DEATH_MS = 2500;

/** Шаги обучающей подсказки (см. HINT_TEXT) — строго по порядку, назад переходит только
 *  'press' <-> 'type' (Esc/таймаут отменяет каст до первого успеха), 'cooldown' и 'goal'
 *  необратимы после первого успешного каста. */
type TrainingHintStage = 'press' | 'type' | 'cooldown' | 'goal';

const HINT_TEXT: Record<TrainingHintStage, string> = {
  press: 'Нажмите горячую клавишу заклинания (от 1 до 5)',
  type: 'Печатайте символы на клавиатуре, ошибка будет сбрасывать прогресс',
  cooldown: 'У заклинаний есть время восстановления, и заклинания одного и того же тира оно общее',
  goal: 'Доведите здоровье соперника до 0',
};

// Сколько подсказка "восстановление" висит перед тем, как её сменит финальная "добей соперника".
const GOAL_HINT_DELAY_MS = 4000;

@Component({
  selector: 'app-match',
  imports: [Character],
  templateUrl: './match.html',
  styleUrl: './match.css',
})
export class Match implements AfterViewInit, OnDestroy {
  protected readonly socket = inject(SocketService);
  private readonly spellSound = inject(SpellSoundService);
  private readonly castingSound = inject(CastingSoundService);

  private readonly youCharRef = viewChild.required<unknown, ElementRef<HTMLElement>>('youChar', {
    read: ElementRef,
  });
  private readonly foeCharRef = viewChild.required<unknown, ElementRef<HTMLElement>>('foeChar', {
    read: ElementRef,
  });
  private readonly projectileCanvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('projectileCanvas');
  private readonly projectileLayer = new ProjectileLayer();

  /** Школа игрока, выбранная ещё в лобби — сервер её самому игроку не возвращает (только
   *  школу соперника, раздел 7.34 game-design.md), поэтому приходит сюда как input. */
  readonly youMageType = input.required<MageType>();
  /** Школа соперника — из match_found (реальный выбор соперника), не локальная заглушка. */
  protected readonly foeMageType = computed<MageType>(
    () => (this.socket.match()?.opponentSchool as MageType | undefined) ?? 'fire',
  );

  protected readonly youAttacking = signal(false);
  protected readonly foeAttacking = signal(false);

  /** spellId проигрываемого сейчас VFX-каста (SPELL_VFX) на этом бойце как ЦЕЛИ заклинания —
   *  null, если сейчас ничего не играется. Независимо от youAttacking/foeAttacking выше, который
   *  всегда проигрывается на кастере вне зависимости от типа заклинания. */
  protected readonly youVfx = signal<string | null>(null);
  protected readonly foeVfx = signal<string | null>(null);

  /** Тряска всей арены на успешный каст заклинания 3 уровня (Ultimate) — независимо от того,
   *  кто из бойцов кастер/цель. */
  protected readonly screenShake = signal(false);
  /** То же самое, но для 2 уровня (Advanced) — вполовину слабее, см. --shake-scale в match.css. */
  protected readonly screenShakeSmall = signal(false);

  /** true — проигрывает анимацию смерти на проигравшем бойце (см. Character.dying) и никогда не
   *  сбрасывается обратно: за матч умереть можно максимум раз. */
  protected readonly youDying = signal(false);
  protected readonly foeDying = signal(false);
  /** Окно результата матча раскрывается не сразу на socket.matchResult(), а только после того, как
   *  на проигравшем доиграет анимация смерти (см. onDeathAnimationEnd) — раздел про смерть перед
   *  победой/поражением. */
  protected readonly showResult = signal(false);
  protected readonly displayedResult = computed(() =>
    this.showResult() ? this.socket.matchResult() : null,
  );
  /** Кто-то из бойцов уже умирает/умер — матч фактически решён, дальше кастовать нельзя, даже
   *  пока окно результата ещё не появилось (см. RESULT_DELAY_AFTER_DEATH_MS). */
  protected readonly matchEnding = computed(() => this.youDying() || this.foeDying());

  /** Сольная тренировка на боте-манекене (см. MatchInfo.mode) — гейтит подсказки, скрывает
   *  таймер окна ввода (оно и правда не ограничено, см. TRAINING_CAST_WINDOW_MS на бэкенде). */
  protected readonly isTraining = computed(() => this.socket.match()?.mode === 'training');

  protected readonly hintStage = signal<TrainingHintStage>('press');
  protected readonly hintText = computed(() => HINT_TEXT[this.hintStage()]);

  protected readonly countdownSeconds = computed(() => {
    const ms = this.socket.countdownMs();
    return ms === null ? null : Math.max(1, Math.ceil(ms / 1000));
  });

  /** Кнопки заклинаний школы игрока — пусто, если для школы ещё нет данных/иконок. */
  protected readonly youSpells = computed(() => SPELL_BUTTONS_BY_SCHOOL[this.youMageType()] ?? []);

  /** Локальный (оптимистичный) счётчик верно введённых символов триггера — обновляется сразу по
   *  keydown в predictKeystroke(), не дожидаясь ответа сервера (input_ack), чтобы клавиши
   *  "нажимались" без задержки на пинг. Проверка символа зеркалит DuelService.handleKeyInput 1-в-1
   *  (сравнение с cast.trigger[typedCount], опечатка полностью сбрасывает прогресс на бэкенде) —
   *  раз клиент шлёт на сервер тот же event.key, что сравнивает сам, локальный и серверный счёт
   *  неизбежно сойдутся, так что тут можно полностью доверять предсказанию, не подмешивая
   *  socket.castProgress(): просто Math.max() с ним ломался бы именно на сбросе — сервер ещё не
   *  прислал progress:0 по опечатке (round trip), и его устаревшее высокое значение маскировало
   *  бы уже случившийся локальный сброс до следующего input_ack. */
  protected readonly locallyTypedCount = signal(0);

  /** 0, если сейчас нет активного каста — locallyTypedCount мог не успеть сброситься (эффект в
   *  constructor реагирует на activeCast() асинхронно), а рисовать нажатые клавиши без открытого
   *  окна каста не должно. */
  protected readonly typedCount = computed(() =>
    this.socket.activeCast() ? this.locallyTypedCount() : 0,
  );

  protected readonly activeCastTrigger = computed(() => {
    const cast = this.socket.activeCast();
    return cast?.trigger ?? null;
  });

  protected readonly youHpPercent = computed(() =>
    this.hpPercentFor(this.socket.match()?.playerId),
  );
  protected readonly foeHpPercent = computed(() =>
    this.hpPercentFor(this.socket.match()?.opponentId),
  );

  /** Оставшийся кулдаун (мс) по spellId для игрока — undefined/отсутствие ключа = готово. */
  protected readonly youCooldowns = computed(() => {
    const playerId = this.socket.match()?.playerId;
    if (!playerId) return {};
    return this.socket.cooldownsByPlayerId()[playerId] ?? {};
  });

  /** Летающие циферки урона/хила — по одному массиву на бойца, элементы сами себя удаляют
   *  через FLOATING_NUMBER_LIFETIME_MS (см. constructor). */
  protected readonly youFloatingNumbers = signal<FloatingNumber[]>([]);
  protected readonly foeFloatingNumbers = signal<FloatingNumber[]>([]);
  /** Incremented on every incoming damage event to restart each fighter's impact flash. */
  protected readonly youHitFlash = signal(0);
  protected readonly foeHitFlash = signal(0);

  /** Активные баффы/дебаффы над персонажем — иконка = иконка заклинания-источника
   *  (`sourceSpellId`), не общая на тип эффекта (раздел 7.25 game-design.md). */
  protected readonly youEffects = computed(() => this.effectsFor(this.socket.match()?.playerId));
  protected readonly foeEffects = computed(() => this.effectsFor(this.socket.match()?.opponentId));

  protected readonly formatCooldown = formatCooldown;
  protected readonly spellIconPath = spellIconPath;
  protected readonly keySpritePath = keySpritePath;

  constructor() {
    // Проигрываем анимацию атаки на любой успешный каст — единственный доступный "эффект
    // применения заклинания" сейчас, независимо от типа заклинания (Attack/Defense/Support).
    effect(() => {
      const resolved = this.socket.lastResolved();
      if (!resolved?.success) return;
      const casterFighter: Fighter = resolved.casterId === this.socket.playerId ? 'you' : 'foe';
      this.triggerAttack(casterFighter);

      this.spellSound.play(spellSoundPath(resolved.spellId));

      // VFX каста играется на ЦЕЛИ заклинания — на самом кастере для баффов (target: 'caster'),
      // на сопернике для урона/дебаффов (target: 'opponent'); см. SPELL_VFX.
      const vfx = SPELL_VFX[resolved.spellId];
      if (vfx) {
        const targetFighter: Fighter =
          vfx.target === 'caster' ? casterFighter : casterFighter === 'you' ? 'foe' : 'you';
        // Winter's Grasp is rendered on the arena-wide projectile canvas; a target-local 64x64
        // effect cannot travel between both fighters or continue through the opponent.
        if (
          resolved.spellId !== 'ice_winters_grasp' &&
          resolved.spellId !== 'arcane_time_warp'
        ) {
          this.triggerVfx(targetFighter, resolved.spellId);
        }

        // Снаряд летит только на удар по сопернику (не на баффы на себя) и только если у школы
        // кастера есть спрайт снаряда (CHARACTER_SPRITES[...].projectile) — сейчас только fire.
        // Spark is the only spell whose impact VFX is paired with an arena-crossing fireball.
        // Other offensive fire spells render only their own target-side animation.
        if (resolved.spellId === 'fire_spark') {
          const casterMageType = casterFighter === 'you' ? this.youMageType() : this.foeMageType();
          const projectileGrid = CHARACTER_SPRITES[casterMageType].projectile;
          if (projectileGrid) {
            const canvas = this.projectileCanvasRef().nativeElement;
            const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
              .nativeElement;
            const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
              .nativeElement;
            this.projectileLayer.fire(
              projectileGrid,
              this.canvasLocalCenter(casterEl, canvas),
              this.canvasLocalCenter(targetEl, canvas),
            );
          }
        } else if (resolved.spellId === 'ice_winters_grasp') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.sweepThrough(
            WINTERS_GRASP_HAND,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'ice_ice_shard') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.fireDirected(
            ICE_SHARD_PROJECTILE,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'chaos_chaos_bolt') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.fireDirected(
            CHAOS_BOLT_PROJECTILE,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'chaos_corruption') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.fireDirected(
            CORRUPTION_HAND_PROJECTILE,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'nature_vine_whip') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.fireDirected(
            VINE_WHIP_PROJECTILE,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'arcane_arcane_missile') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const targetEl = (targetFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          this.projectileLayer.fireArcaneVolley(
            ARCANE_MISSILE_PROJECTILE,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(targetEl, canvas),
          );
        } else if (resolved.spellId === 'arcane_time_warp') {
          const canvas = this.projectileCanvasRef().nativeElement;
          const casterEl = (casterFighter === 'you' ? this.youCharRef() : this.foeCharRef())
            .nativeElement;
          const opponentEl = (casterFighter === 'you' ? this.foeCharRef() : this.youCharRef())
            .nativeElement;
          this.projectileLayer.showTimeWarp(
            TIME_WARP_HOURGLASS,
            this.canvasLocalCenter(casterEl, canvas),
            this.canvasLocalCenter(opponentEl, canvas),
          );
        }
      }

      // Tier 3 (Ultimate) трясёт на полную, tier 2 (Advanced) — вполовину слабее (screen-shake-small).
      const tier = SPELL_BY_ID[resolved.spellId]?.tier;
      if (tier === 3) this.triggerScreenShake();
      else if (tier === 2) this.triggerScreenShakeSmall();
    });

    // Зацикленный звук школы, пока у ИГРОКА открыто окно ввода триггера (socket.activeCast()
    // приходит только самому кастующему клиенту, см. DuelGateway.handleCastStart — так что этот
    // эффект никогда не видит чужой активный каст соперника).
    effect(() => {
      if (this.socket.activeCast()) this.castingSound.start(castingSoundPath(this.youMageType()));
      else this.castingSound.stop();
    });

    // Сброс локального предсказания (см. locallyTypedCount) на любую смену activeCast — и на
    // старте нового каста (typedCount должен начаться с 0), и на его завершении/отмене.
    effect(() => {
      this.socket.activeCast();
      this.locallyTypedCount.set(0);
    });

    // Летающая циферка урона/хила на любое изменение HP любого игрока — источник (прямой удар,
    // DoT-тик, отражение щитом и т.д.) не важен, просто разница в player_sync.
    effect(() => {
      const change = this.socket.lastHpChange();
      const match = this.socket.match();
      if (!change || !match) return;

      const fighter: Fighter | null =
        change.playerId === match.playerId
          ? 'you'
          : change.playerId === match.opponentId
            ? 'foe'
            : null;
      if (!fighter) return;

      const list = fighter === 'you' ? this.youFloatingNumbers : this.foeFloatingNumbers;
      if (change.amount < 0) {
        (fighter === 'you' ? this.youHitFlash : this.foeHitFlash).update((value) => value + 1);
      }
      const entry: FloatingNumber = {
        id: change.id,
        text: (change.amount > 0 ? '+' : '') + change.amount,
        kind: change.amount > 0 ? 'heal' : 'damage',
      };
      list.update((arr) => [...arr, entry]);
      setTimeout(
        () => list.update((arr) => arr.filter((e) => e.id !== entry.id)),
        FLOATING_NUMBER_LIFETIME_MS,
      );
    });

    // Анимация смерти на проигравшем при завершении матча — окно результата раскрывается не
    // сразу на matchResult(), а только когда она доиграет (см. onDeathAnimationEnd).
    effect(() => {
      const result = this.socket.matchResult();
      if (!result) return;
      const loserFighter: Fighter = result === 'loss' ? 'you' : 'foe';
      (loserFighter === 'you' ? this.youDying : this.foeDying).set(true);
    });

    // Подсказки обучения — читает activeCast()/lastResolved() целиком на каждое изменение,
    // а не пытается различить "было true, стало false" по предыдущему значению: оба сигнала
    // обновляются синхронно из одного и того же события (см. SocketService — spell_resolved
    // чистит activeCast только для своего кастера), так что эффект видит согласованную пару.
    // 'press' <-> 'type' может качаться туда-сюда сколько угодно (открыл окно — Esc/пока не
    // докастовал — снова открыл), а вот 'cooldown'/'goal' необратимы после первого успеха.
    effect(() => {
      if (!this.isTraining()) return;
      const cast = this.socket.activeCast();
      const resolved = this.socket.lastResolved();

      if (cast) {
        if (this.hintStage() === 'press') this.hintStage.set('type');
        return;
      }

      if (this.hintStage() !== 'type') return;

      if (resolved?.success && resolved.casterId === this.socket.playerId) {
        this.hintStage.set('cooldown');
        setTimeout(() => {
          if (this.hintStage() === 'cooldown') this.hintStage.set('goal');
        }, GOAL_HINT_DELAY_MS);
      } else {
        this.hintStage.set('press'); // отменили (Esc) или сгорел каст, так и не докастовав
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.projectileLayer.init(this.projectileCanvasRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.projectileLayer.destroy();
  }

  /** Точка на теле бойца в локальных координатах canvas (CSS px) — для позиционирования снаряда,
   *  который летает в canvas-пространстве, а не в DOM. Целится в сам .sprite-canvas персонажа
   *  (не в весь хост-элемент — тот выше из-за баннера имени/HP-бара над спрайтом) и берёт точку
   *  чуть ниже его центра, на уровне руки/торса, а не капюшона. */
  private canvasLocalCenter(el: HTMLElement, canvas: HTMLCanvasElement): Point {
    const spriteEl = el.querySelector('.sprite-canvas') ?? el;
    const canvasRect = canvas.getBoundingClientRect();
    const rect = spriteEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - canvasRect.left,
      y: rect.top + rect.height * 0.62 - canvasRect.top,
    };
  }

  private hpPercentFor(playerId: string | undefined): number {
    if (!playerId) return 100;
    const hp = this.socket.hpByPlayerId()[playerId];
    if (!hp) return 100;
    return Math.max(0, Math.min(100, (hp.hp / hp.maxHp) * 100));
  }

  private effectsFor(playerId: string | undefined) {
    if (!playerId) return [];
    return this.socket.effectsByPlayerId()[playerId] ?? [];
  }

  castSpellByIndex(index: number): void {
    if (this.socket.activeCast() || !this.socket.matchStarted() || this.matchEnding()) return;
    const spell = this.youSpells()[index];
    if (!spell || this.youCooldowns()[spell.id] !== undefined) return;
    this.socket.castSpell(spell.id);
  }

  /** Компонент существует только пока идёт матч, так что в отличие от прежнего
   *  window-listener'а в App проверка на "матч вообще есть" тут не нужна. */
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.socket.cancelCast();
      return;
    }
    if (event.key.length !== 1) return;

    const cast = this.socket.activeCast();
    if (cast) {
      this.socket.sendKey(event.key);
      this.predictKeystroke(cast.trigger, event.key);
      return;
    }

    const index = Number(event.key) - 1;
    if (Number.isInteger(index)) this.castSpellByIndex(index);
  }

  /** Зеркалит проверку символа из DuelService.handleKeyInput на бэкенде — см. locallyTypedCount. */
  private predictKeystroke(trigger: string, char: string): void {
    const expected = trigger[this.locallyTypedCount()];
    this.locallyTypedCount.set(char === expected ? this.locallyTypedCount() + 1 : 0);
  }

  /** Plays the cast/attack sprite once for the given fighter. Safe to call again mid-animation. */
  triggerAttack(fighter: Fighter): void {
    const attacking = fighter === 'you' ? this.youAttacking : this.foeAttacking;
    attacking.set(false);
    requestAnimationFrame(() => attacking.set(true));
  }

  onAttackAnimationEnd(fighter: Fighter): void {
    (fighter === 'you' ? this.youAttacking : this.foeAttacking).set(false);
  }

  /** Раскрывает окно результата матча — вызывается, когда на проигравшем доиграла анимация
   *  смерти (см. эффект на socket.matchResult() в конструкторе), а не сразу на matchResult().
   *  Ещё RESULT_DELAY_AFTER_DEATH_MS сверху — даёт разглядеть кадр погибшего перед оверлеем. */
  onDeathAnimationEnd(): void {
    setTimeout(() => this.showResult.set(true), RESULT_DELAY_AFTER_DEATH_MS);
  }

  /** Plays the cast VFX sprite once on the given fighter (the spell's target). Safe to call
   *  again mid-animation. */
  triggerVfx(fighter: Fighter, spellId: string): void {
    const vfx = fighter === 'you' ? this.youVfx : this.foeVfx;
    vfx.set(null);
    requestAnimationFrame(() => vfx.set(spellId));
  }

  onVfxAnimationEnd(fighter: Fighter): void {
    (fighter === 'you' ? this.youVfx : this.foeVfx).set(null);
  }

  /** Plays the screen-shake animation once. Safe to call again mid-animation. */
  triggerScreenShake(): void {
    this.screenShake.set(false);
    requestAnimationFrame(() => this.screenShake.set(true));
  }

  /** Plays the smaller (tier 2) screen-shake animation once. Safe to call again mid-animation. */
  triggerScreenShakeSmall(): void {
    this.screenShakeSmall.set(false);
    requestAnimationFrame(() => this.screenShakeSmall.set(true));
  }

  /** target/currentTarget вместо сравнения animationName — Angular переименовывает имена
   *  keyframes в скомпилированном CSS (emulated view encapsulation), так что рантайм-имя
   *  анимации не совпадает с литералом 'screen-shake' из match.css. target === currentTarget
   *  верно отсекает animationend, всплывшие от вложенных VFX/атака-анимаций персонажей. */
  onSceneAnimationEnd(event: AnimationEvent): void {
    if (event.target !== event.currentTarget) return;
    this.screenShake.set(false);
    this.screenShakeSmall.set(false);
  }

  /** Кнопка на экране результата матча. Компонент размонтируется вместе с этим (match
   *  становится null), так что локальные сигналы (анимации, циферки) не нужно сбрасывать
   *  вручную — следующий матч создаст Match заново с чистого листа. */
  returnToMenu(): void {
    this.socket.resetMatch();
  }
}
